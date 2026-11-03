// Cost and quality benchmark: the same fixed interview through each model, with real OpenRouter costs.
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/bench/cost-bench.ts out.json qwen/qwen3.7-flash deepseek/deepseek-v4.1-flash ...
// Reads OPENROUTER_API_KEY from .dev.vars. Each model runs 4 scored turns (2 strong answers, 2 evasive or off-topic
// "traps") plus a short summary report, exactly as production builds them (same prompts, token caps, reasoning off).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ReportSchema, ScoreSchema, type Score } from '../../shared/schema';
import type { ScoreRequest } from '../../shared/api';
import { buildReportMessages, buildScoreMessages } from '../../functions/_lib/prompts';
import { parseModelJson } from '../../functions/_lib/llm';
import { inLanguage } from '../../functions/_lib/lang';
import { scoreTexts } from '../../functions/api/score';
import { normalizeScore } from '../../shared/grade';
import { SAMPLE } from '../../src/samples/sample';
import { chunkDoc } from '../../src/docs/chunk';
import { jdFacts } from '../../src/docs/jd';
import { buildTemplatePlan } from '../../src/engine/templates';
import { summarize, type TurnResult } from './metrics';

const root = join(import.meta.dirname, '..', '..');
const key = readFileSync(join(root, '.dev.vars'), 'utf8').match(/OPENROUTER_API_KEY=(.*)/)?.[1]?.trim().replace(/"/g, '');
if (!key) throw new Error('OPENROUTER_API_KEY missing in .dev.vars');
const [out = 'bench.json', ...models] = process.argv.slice(2);
if (!models.length) throw new Error('usage: cost-bench.ts out.json <model> [model...]');

const s = SAMPLE.ko;
const chunks = [...chunkDoc('jd', s.docs.jd), ...chunkDoc('resume', s.docs.resume), ...chunkDoc('portfolio', s.docs.portfolio)];
const ivs = [
  { id: 'iv1', role: 'other', rank: 'exec', gender: 'male', personality: 'strict', seed: 11 },
  { id: 'iv2', role: 'hr', rank: 'manager', gender: 'female', personality: 'warm', seed: 23 },
  { id: 'iv3', role: 'dev', rank: 'staff', gender: 'male', personality: 'pressure', seed: 37 },
] as ScoreRequest['interviewers'];
const plan = buildTemplatePlan({ lang: 'ko', company: s.company, role: s.role, career: 'exp', interviewers: ivs, chunks });
const facts = jdFacts(s.docs.jd);
const resume = chunks.filter((c) => c.kind !== 'jd');

// Fixed answers: what a good evaluator should do is known in advance.
const TURNS: { q: number; answer: string; expect: TurnResult['expect'] }[] = [
  { q: 0, expect: 'strong', answer: '5년차 서비스 기획자입니다. 정기배송 구독을 0에서 1로 기획해 출시 1년 만에 구독자 4만 명을 모았고, 재구매 추천 실험으로 재구매율을 18%에서 27%로 올렸습니다. 그린마켓의 주문·결제 경험을 데이터로 개선하는 데 바로 기여하겠습니다.' },
  { q: 2, expect: 'trap', answer: '음.. 그건 팀에서 같이 한 거라 제 기여를 정확히 수치로 말하기는 어렵습니다.' },
  { q: 5, expect: 'strong', answer: '가장 자신 있는 건 실험 설계입니다. 결제 단계를 5단계에서 3단계로 줄이는 A/B 테스트를 6주간 운영했고, 표본 12만 명 기준 이탈률이 32%에서 21%로 내려갔습니다. 가설 수립과 지표 정의, 개발팀과의 우선순위 조율을 제가 맡았습니다.' },
  { q: 7, expect: 'trap', answer: '저는 주말에 등산을 좋아하고 체력에 자신이 있습니다. 열심히 하겠습니다.' },
];

async function call(model: string, messages: unknown, maxTokens: number) {
  const t0 = Date.now();
  const send = (reasoning: object) =>
    fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.6, usage: { include: true }, max_tokens: maxTokens, reasoning }),
    });
  let r = await send({ enabled: false });
  // Some high-end models cannot turn reasoning off: run them with the lowest effort (their reasoning tokens are billed).
  if (r.status === 400 && (await r.clone().text()).includes('Reasoning is mandatory')) r = await send({ effort: 'low' });
  const j = (await r.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }; error?: { message?: string } };
  const u = j.usage ?? {};
  return { status: r.status, ms: Date.now() - t0, content: j.choices?.[0]?.message?.content ?? '', error: j.error?.message, tokensIn: u.prompt_tokens ?? 0, tokensOut: u.completion_tokens ?? 0, costUsd: u.cost ?? 0 };
}

type Row = TurnResult & { question: string; answer: string; error?: string; nextText?: string; verdict?: string; raw?: string };
const results: Record<string, { turns: Row[] }> = {};
for (const model of models) {
  const rs: Row[] = [];
  const history: string[] = [];
  const scored: { questionId: string; stage: ScoreRequest['question']['stage']; score: Score }[] = [];
  for (const turn of TURNS) {
    const q = plan.questions[turn.q];
    const nq = plan.questions[turn.q + 1];
    const ev = q.evidenceIds.map((id) => chunks.find((c) => c.id === id)).filter(Boolean).concat(resume.slice(0, 2)).slice(0, 3) as typeof chunks;
    const req: ScoreRequest = {
      sid: 'bench', lang: 'ko', question: q, answer: turn.answer, thread: [], evidence: ev.map((c) => ({ ...c, text: c.text.slice(0, 500) })), history: history.slice(-4), interviewers: ivs,
      followUpsUsed: 0, followUpLimit: 1, asked: plan.questions.slice(0, turn.q + 1).map((x) => x.text).slice(-6), upcoming: plan.questions.slice(turn.q + 1, turn.q + 3).map((x) => x.text),
      jdFacts: facts, next: nq ? { stage: nq.stage, askedBy: nq.askedBy, draft: nq.text, intent: nq.intent } : undefined,
    };
    const r = await call(model, buildScoreMessages(req), 1800);
    const raw = parseModelJson(r.content);
    const parsed = ScoreSchema.safeParse(raw);
    const langOk = parsed.success && inLanguage('ko', scoreTexts(parsed.data), [turn.answer, q.text, facts, ...ev.map((c) => `${c.id} ${c.text}`)].join(' '));
    const ok = r.status === 200 && parsed.success && langOk;
    // Why a reply was rejected: no JSON (often cut off at the token cap), wrong shape, or wrong language.
    const why = ok ? '' : !raw ? (r.tokensOut >= 1800 ? 'truncated at token cap' : 'no JSON') : !parsed.success ? `schema: ${parsed.error.issues.slice(0, 2).map((i) => i.path.join('.') + ' ' + i.message).join('; ')}` : 'language check';
    const sc = parsed.success ? normalizeScore(parsed.data) : null;
    if (sc) {
      history.push(sc.summary);
      scored.push({ questionId: q.id, stage: q.stage, score: sc });
    }
    rs.push({
      kind: 'turn', ok, ms: r.ms, tokensIn: r.tokensIn, tokensOut: r.tokensOut, costUsd: r.costUsd, score: sc?.score ?? null, expect: turn.expect,
      followUp: sc?.followUp?.needed ? sc.followUp.text : null, next: sc?.next?.text ?? null, nextWanted: !!nq,
      question: q.text, answer: turn.answer, nextText: sc?.next?.text, raw: ok ? undefined : r.content.slice(0, 6000), verdict: sc?.guide?.verdict, error: r.status === 200 ? (why || undefined) : `${r.status} ${r.error ?? ''}`.trim(),
    });
    console.log(model, 'turn', turn.q, r.status, `${r.ms}ms`, `$${r.costUsd}`, 'score', sc?.score ?? '-', ok ? 'ok' : `INVALID (${why})`);
  }
  if (scored.length) {
    const r = await call(model, buildReportMessages({ sid: 'bench', lang: 'ko', company: s.company, role: s.role, interviewers: ivs.map((i) => ({ id: i.id, displayName: i.id, title: '' })), items: scored, brief: true }), 900);
    const parsed = ReportSchema.safeParse(parseModelJson(r.content));
    rs.push({ kind: 'report', ok: r.status === 200 && parsed.success, ms: r.ms, tokensIn: r.tokensIn, tokensOut: r.tokensOut, costUsd: r.costUsd, score: null, expect: 'normal', followUp: null, next: null, nextWanted: false, question: 'report', answer: '', verdict: parsed.success ? parsed.data.publicSummary.oneLiner : undefined, error: r.status === 200 ? undefined : `${r.status} ${r.error ?? ''}`.trim() });
    console.log(model, 'report', r.status, `${r.ms}ms`, `$${r.costUsd}`, parsed.success ? 'ok' : 'INVALID');
  }
  results[model] = { turns: rs };
}

const summaries = Object.entries(results).map(([m, r]) => summarize(m, r.turns));
writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), summaries, results }, null, 1));
const krw = (usd: number) => `${(usd * 1400).toFixed(1)}원`;
console.log('\n| model | valid | p50 | 1 turn | quick (3) | full (11) | strong−trap | specific follow-ups | next written |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const x of summaries)
  console.log(`| ${x.model} | ${Math.round(x.validRate * 100)}% | ${(x.p50Ms / 1000).toFixed(1)}s | $${x.perTurnUsd.toFixed(6)} | $${x.quickInterviewUsd.toFixed(5)} (${krw(x.quickInterviewUsd)}) | $${x.fullInterviewUsd.toFixed(4)} (${krw(x.fullInterviewUsd)}) | ${x.trapGap ?? '-'}${x.trapCaught ? ' ✓' : ''} | ${x.followUpSpecificRate == null ? '-' : Math.round(x.followUpSpecificRate * 100) + '%'} | ${x.nextRate == null ? '-' : Math.round(x.nextRate * 100) + '%'} |`);
