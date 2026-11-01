import { LIMITS, type PlanRequest } from '../../shared/api';
import type { Plan } from '../../shared/schema';
import { admit } from '../_lib/endpoint';
import type { Env } from '../_lib/env';
import { fakePlan } from '../_lib/fake';
import { guard, json } from '../_lib/http';
import { inLanguage } from '../_lib/lang';
import { callJson } from '../_lib/llm';
import { FramePartSchema, mergePlanParts, PART_STAGES, QuestionsPartSchema, type PartName } from '../_lib/planParts';
import { buildPlanPartMessages, validatePlanEvidence } from '../_lib/prompts';

const TIMING = { timeoutMs: 75_000, freeBudgetMs: 70_000, deadlineMs: 150_000 };

export async function handlePlan(req: Request, env: Env, fetchFn?: typeof fetch): Promise<Response> {
  return guard(async () => {
    const body = await admit<PlanRequest>(req, env, 'plan', LIMITS.planBytes);
    body.chunks = (body.chunks ?? []).slice(0, 400);
    body.interviewers = (body.interviewers ?? []).slice(0, 4);
    if (!body.interviewers.length) return json(400, { error: 'interviewers' });
    const source = [body.company, body.role, ...body.chunks.map((c) => c.text)].join(' ');
    const fake = fakePlan(body);
    const fakePart = (part: PartName) => ({ ...fake, questions: fake.questions.filter((q) => PART_STAGES[part].includes(q.stage)) });
    const okLang = (qs: Plan['questions']) => inLanguage(body.lang, qs.map((q) => q.text), source);
    // Three smaller calls in parallel: faster, and one failing part does not sink the plan.
    const [frame, exp, comp] = await Promise.all([
      callJson(env, { ...TIMING, fetchFn, messages: buildPlanPartMessages(body, 'frame'), schema: FramePartSchema, fake: () => fakePart('frame'), validate: (d) => okLang(d.questions) }),
      callJson(env, { ...TIMING, fetchFn, messages: buildPlanPartMessages(body, 'experience'), schema: QuestionsPartSchema, fake: () => fakePart('experience'), validate: (d) => okLang(d.questions) }),
      callJson(env, { ...TIMING, fetchFn, messages: buildPlanPartMessages(body, 'competency'), schema: QuestionsPartSchema, fake: () => fakePart('competency'), validate: (d) => okLang(d.questions) }),
    ]);
    const merged = mergePlanParts(body, frame.ok ? frame.data : null, exp.ok ? exp.data : null, comp.ok ? comp.data : null);
    if (!merged || !merged.questions.length) return json(200, { ok: false, fallback: true });
    const { plan, missing } = validatePlanEvidence(merged, new Set(body.chunks.map((c) => c.id)));
    // Resume questions without real evidence are dropped; the client fills the gap from grounded templates.
    const out = { ...plan, questions: plan.questions.filter((q) => !missing.includes(q.id)) };
    const models = [frame, exp, comp].map((r) => (r.ok ? r.model : 'fallback')).join('+');
    return json(200, { ok: true, data: out, model: models });
  });
}

export const onRequestPost: PagesFunction<Env> = (ctx) => handlePlan(ctx.request, ctx.env);
