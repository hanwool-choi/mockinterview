import { LIMITS, type ReportRequest } from '../../shared/api';
import { gradeOf } from '../../shared/grade';
import { ReportSchema } from '../../shared/schema';
import { admit } from '../_lib/endpoint';
import type { Env } from '../_lib/env';
import { fakeReport } from '../_lib/fake';
import { guard, json } from '../_lib/http';
import { callJson } from '../_lib/llm';
import { charge } from '../_lib/budget';
import { buildReportMessages } from '../_lib/prompts';
import { inLanguage } from '../_lib/lang';

export async function handleReport(req: Request, env: Env, fetchFn?: typeof fetch): Promise<Response> {
  return guard(async () => {
    const body = await admit<ReportRequest>(req, env, 'report', LIMITS.reportBytes);
    if (!Array.isArray(body.items) || !body.items.length) return json(400, { error: 'items' });
    const r = await callJson(env, { messages: buildReportMessages(body), schema: ReportSchema, timeoutMs: 60_000, freeBudgetMs: 50_000, deadlineMs: 120_000, maxTokens: body.brief ? 900 : 2000, fetchFn, fake: () => fakeReport(body), validate: (d) => inLanguage(body.lang, [d.privateDetail.verdictReason, ...d.privateDetail.top3Fixes]) });
    await charge(env, body.sid, 'report', r.ok ? r.model : 'fallback', r.usage);
    if (!r.ok) return json(200, { ok: false, fallback: true });
    // The headline number is always the true average, not the model's guess.
    const avg = Math.round(body.items.reduce((n, i) => n + i.score.score, 0) / body.items.length);
    r.data.publicSummary = { ...r.data.publicSummary, company: body.company, role: body.role, score: avg, grade: gradeOf(avg) };
    return json(200, { ok: true, data: r.data, model: r.model });
  });
}

export const onRequestPost: PagesFunction<Env> = (ctx) => handleReport(ctx.request, ctx.env);
