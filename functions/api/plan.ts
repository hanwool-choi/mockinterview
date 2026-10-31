import { z } from 'zod';
import { LIMITS, type PlanRequest } from '../../shared/api';
import { PlanSchema, QuestionSchema } from '../../shared/schema';
import { admit } from '../_lib/endpoint';
import type { Env } from '../_lib/env';
import { fakePlan } from '../_lib/fake';
import { guard, json } from '../_lib/http';
import { callJson } from '../_lib/llm';
import { buildPlanMessages, buildRegenMessages, validatePlanEvidence } from '../_lib/prompts';

export async function handlePlan(req: Request, env: Env, fetchFn?: typeof fetch): Promise<Response> {
  return guard(async () => {
    const body = await admit<PlanRequest>(req, env, 'plan', LIMITS.planBytes);
    body.chunks = (body.chunks ?? []).slice(0, 400);
    body.interviewers = (body.interviewers ?? []).slice(0, 4);
    if (!body.interviewers.length) return json(400, { error: 'interviewers' });
    const r = await callJson(env, { messages: buildPlanMessages(body), schema: PlanSchema, timeoutMs: 45_000, deadlineMs: 80_000, fetchFn, fake: () => fakePlan(body) });
    if (!r.ok) return json(200, { ok: false, fallback: true });
    const ids = new Set(body.chunks.map((c) => c.id));
    let { plan, missing } = validatePlanEvidence(r.data, ids);
    if (missing.length && r.model !== 'fake') {
      const regen = await callJson(env, {
        messages: buildRegenMessages(body, plan, missing),
        schema: z.object({ questions: z.array(QuestionSchema) }),
        timeoutMs: 15_000, maxModels: 1, fetchFn, fake: () => ({ questions: [] }),
      });
      if (regen.ok) {
        const byId = new Map(regen.data.questions.map((q) => [q.id, q]));
        plan = { ...plan, questions: plan.questions.map((q) => byId.get(q.id) ?? q) };
        ({ plan, missing } = validatePlanEvidence(plan, ids));
      }
      plan = { ...plan, questions: plan.questions.filter((q) => !missing.includes(q.id)) };
    }
    return json(200, { ok: true, data: plan, model: r.model });
  });
}

export const onRequestPost: PagesFunction<Env> = (ctx) => handlePlan(ctx.request, ctx.env);
