import { LIMITS, type ScoreRequest } from '../../shared/api';
import { normalizeScore } from '../../shared/grade';
import { ScoreSchema, type Score } from '../../shared/schema';
import { admit } from '../_lib/endpoint';
import type { Env } from '../_lib/env';
import { fakeScore } from '../_lib/fake';
import { guard, json } from '../_lib/http';
import { callJson } from '../_lib/llm';
import { charge } from '../_lib/budget';
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

/** The rewritten next question is a bonus: drop it (the client keeps its draft) unless it is asked for, sized and in language. */
export function usableNext(body: ScoreRequest, next: Score['next']): Score['next'] {
  if (!body.next || !next?.text) return null;
  const text = next.text.trim();
  if (text.length < 8 || text.length > 400) return null;
  const source = [body.answer, body.question.text, body.next.draft, body.jdFacts ?? '', ...body.evidence.map((c) => c.text)].join(' ');
  if (!inLanguage(body.lang, [text], source)) return null;
  return { text, intent: next.intent?.trim() || body.next.intent };
}

export async function handleScore(req: Request, env: Env, fetchFn?: typeof fetch): Promise<Response> {
  return guard(async () => {
    const body = await admit<ScoreRequest>(req, env, 'score', LIMITS.scoreBytes);
    if (!body.question?.text || typeof body.answer !== 'string') return json(400, { error: 'input' });
    const r = await callJson(env, { messages: buildScoreMessages(body), schema: ScoreSchema, timeoutMs: 45_000, freeBudgetMs: 35_000, deadlineMs: 85_000, maxTokens: 1800, fetchFn, fake: () => fakeScore(body), validate: (d) => inLanguage(body.lang, scoreTexts(d), [body.answer, body.question.text, body.jdFacts ?? '', ...body.evidence.map((c) => `${c.id} ${c.text}`)].join(' ')) });
    await charge(env, body.sid, 'score', r.ok ? r.model : 'fallback', r.usage);
    if (!r.ok) return json(200, { ok: false, fallback: true });
    const data = normalizeScore(r.data);
    const known = new Set(body.interviewers.map((i) => i.id));
    if (body.followUpsUsed >= body.followUpLimit || !data.followUp?.needed || !data.followUp.text) data.followUp = null;
    else if (!known.has(data.followUp.askedBy)) data.followUp = { ...data.followUp, askedBy: '' };
    data.reactions = data.reactions.filter((x) => known.has(x.interviewerId));
    data.next = usableNext(body, data.next);
    return json(200, { ok: true, data, model: r.model });
  });
}

export const onRequestPost: PagesFunction<Env> = (ctx) => handleScore(ctx.request, ctx.env);
