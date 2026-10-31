import { LIMITS, type ScoreRequest } from '../../shared/api';
import { normalizeScore } from '../../shared/grade';
import { ScoreSchema } from '../../shared/schema';
import { admit } from '../_lib/endpoint';
import type { Env } from '../_lib/env';
import { fakeScore } from '../_lib/fake';
import { guard, json } from '../_lib/http';
import { callJson } from '../_lib/llm';
import { buildScoreMessages } from '../_lib/prompts';

export async function handleScore(req: Request, env: Env, fetchFn?: typeof fetch): Promise<Response> {
  return guard(async () => {
    const body = await admit<ScoreRequest>(req, env, 'score', LIMITS.scoreBytes);
    if (!body.question?.text || typeof body.answer !== 'string') return json(400, { error: 'input' });
    const r = await callJson(env, { messages: buildScoreMessages(body), schema: ScoreSchema, timeoutMs: 14_000, deadlineMs: 28_000, fetchFn, fake: () => fakeScore(body) });
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
