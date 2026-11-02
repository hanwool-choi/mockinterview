import { LIMITS, type ScoreRequest } from '../../shared/api';
import { normalizeScore } from '../../shared/grade';
import { ScoreSchema, type Score } from '../../shared/schema';
import { admit } from '../_lib/endpoint';
import type { Env } from '../_lib/env';
import { fakeScore } from '../_lib/fake';
import { guard, json } from '../_lib/http';
import { callJson } from '../_lib/llm';
import { buildScoreMessages } from '../_lib/prompts';
import { inLanguage } from '../_lib/lang';

/** Every model-written sentence the candidate will read, so a stray language anywhere rejects the output. */
export function scoreTexts(d: Pick<Score, 'improvements' | 'strengths' | 'betterAnswer' | 'followUp' | 'reactions' | 'guide'>): string[] {
  const g = d.guide;
  return [
    ...d.improvements, ...d.strengths, d.betterAnswer, d.followUp?.text ?? '',
    ...d.reactions.map((r) => r.line),
    ...(g ? [g.verdict, g.evidence ?? '', g.drill ?? '', ...g.fixes.flatMap((f) => [f.point, f.how, f.example ?? '']), ...g.phrasing.map((p) => p.to)] : []),
  ].filter((t): t is string => !!t);
}

export async function handleScore(req: Request, env: Env, fetchFn?: typeof fetch): Promise<Response> {
  return guard(async () => {
    const body = await admit<ScoreRequest>(req, env, 'score', LIMITS.scoreBytes);
    if (!body.question?.text || typeof body.answer !== 'string') return json(400, { error: 'input' });
    const r = await callJson(env, { messages: buildScoreMessages(body), schema: ScoreSchema, timeoutMs: 45_000, freeBudgetMs: 35_000, deadlineMs: 85_000, fetchFn, fake: () => fakeScore(body), validate: (d) => inLanguage(body.lang, scoreTexts(d), [body.answer, body.question.text, ...body.evidence.map((c) => c.text)].join(' ')) });
    if (!r.ok) return json(200, { ok: false, fallback: true });
    const data = normalizeScore(r.data);
    const known = new Set(body.interviewers.map((i) => i.id));
    if (body.followUpsUsed >= body.followUpLimit || !data.followUp?.needed || !data.followUp.text) data.followUp = null;
    else if (!known.has(data.followUp.askedBy)) data.followUp = { ...data.followUp, askedBy: '' };
    data.reactions = data.reactions.filter((x) => known.has(x.interviewerId));
    return json(200, { ok: true, data, model: r.model });
  });
}

export const onRequestPost: PagesFunction<Env> = (ctx) => handleScore(ctx.request, ctx.env);
