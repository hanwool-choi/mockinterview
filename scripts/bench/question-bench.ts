// Question quality benchmark: the same scripted interview through the score prompt, then every question the
// model writes (next question, follow-up) is checked the way a candidate would feel it.
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/bench/question-bench.ts <model> [promptsModule] [templatesModule]
// Reads OPENROUTER_API_KEY from .dev.vars. Defaults to the repo's prompts and templates; pass other module paths
// (for example an older version extracted with git show) to compare.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ScoreSchema } from '../../shared/schema';
import type { ScoreRequest } from '../../shared/api';
import { parseModelJson } from '../../functions/_lib/llm';
import { groundedQuestion } from '../../functions/_lib/question';
import { questionSource, usableNext } from '../../functions/api/score';
import { SAMPLE } from '../../src/samples/sample';
import { chunkDoc } from '../../src/docs/chunk';
import { jdFacts } from '../../src/docs/jd';

const root = join(import.meta.dirname, '..', '..');
const key = readFileSync(join(root, '.dev.vars'), 'utf8').match(/OPENROUTER_API_KEY=(.*)/)?.[1]?.trim().replace(/"/g, '');
if (!key) throw new Error('OPENROUTER_API_KEY missing in .dev.vars');
const [model = 'google/gemini-2.5-flash-lite', promptsPath, templatesPath] = process.argv.slice(2);
const { buildScoreMessages } = (await import(promptsPath ? resolve(promptsPath) : '../../functions/_lib/prompts')) as typeof import('../../functions/_lib/prompts');
const { buildTemplatePlan } = (await import(templatesPath ? resolve(templatesPath) : '../../src/engine/templates')) as typeof import('../../src/engine/templates');

const s = SAMPLE.ko;
const chunks = [...chunkDoc('jd', s.docs.jd), ...chunkDoc('resume', s.docs.resume), ...chunkDoc('portfolio', s.docs.portfolio)];
const ivs = [
  { id: 'iv1', role: 'other', rank: 'lead', gender: 'male', personality: 'strict', seed: 11 },
  { id: 'iv2', role: 'hr', rank: 'manager', gender: 'female', personality: 'warm', seed: 23 },
] as ScoreRequest['interviewers'];
const plan = buildTemplatePlan({ lang: 'ko', company: s.company, role: s.role, career: 'exp', interviewers: ivs, chunks });
const facts = jdFacts(s.docs.jd);
const resume = chunks.filter((c) => c.kind !== 'jd');

// Realistic answers: strong, vague, team-centred ("we"), off-topic.
const TURNS = [
  { q: 0, answer: '5년차 서비스 기획자입니다. 오늘장보기에서 정기배송 구독을 처음부터 기획해 1년 만에 구독자 4만 명을 모았고, 장바구니 재구매 추천으로 재구매율도 올렸습니다. 그린마켓에서도 재구매 경험을 데이터로 키우고 싶습니다.' },
  { q: 1, answer: '지금 회사에서 구독 서비스를 안정화했고, 이제는 주문부터 결제까지 더 넓은 범위를 맡고 싶어서 이직을 결심했습니다. 그린마켓은 신선식품 재구매가 핵심이라 제 경험이 바로 쓰일 것 같았습니다.' },
  { q: 2, answer: '추천 기능은 저희 팀이 같이 만든 건데요, 실험을 6주 돌려서 재구매율이 올랐습니다. 다들 고생을 많이 했습니다.' },
  { q: 3, answer: '가장 어려웠던 건 물류 용량이었습니다. 주문이 몰리면서 2주 정도 배송이 늦어졌고, 물류팀과 주문 마감 시간을 앞당겨서 해결했습니다.' },
  { q: 4, answer: '음 그건 제가 기획을 다 했다고 봐도 될 것 같습니다. 열심히 했습니다.' },
];

async function call(messages: unknown) {
  for (let i = 0; i < 5; i++) {
    const r = await once(messages);
    if (r.status !== 429) return r;
    await new Promise((ok) => setTimeout(ok, 4000 * (i + 1))); // upstream rate limit: wait and retry
  }
  return once(messages);
}

async function once(messages: unknown) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: 1800, reasoning: { enabled: false }, usage: { include: true } }),
  });
  const j = (await r.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; usage?: { cost?: number } };
  return { status: r.status, content: j.choices?.[0]?.message?.content ?? '', cost: j.usage?.cost ?? 0 };
}

const LINK = /말씀하신|방금|하셨는데|하셨다고|이번엔|이번에는|넘어가|여쭤볼게|주제를|얘기가 나와/;
// Several asks chained in one turn ("~인지, 그리고 ~는지", "A, and B?").
const MULTI = /그리고|는지[^?]*는지|, and (what|how|why)|\? .*\?/;
const rows: { kind: string; text: string; grounded: boolean; linked: boolean; multi: boolean; len: number }[] = [];
const CHECKS = process.env.NO_CHECKS !== '1';
let cost = 0;
const history: string[] = [];
for (const t of TURNS) {
  const q = plan.questions[t.q];
  const nq = plan.questions[t.q + 1];
  const ev = q.evidenceIds.map((id) => chunks.find((c) => c.id === id)).filter(Boolean).concat(resume.slice(0, 2)).slice(0, 3) as typeof chunks;
  const req: ScoreRequest = {
    sid: 'bench', lang: 'ko', question: q, answer: t.answer, thread: [], evidence: ev.map((c) => ({ ...c, text: c.text.slice(0, 500) })), history: history.slice(-4), interviewers: ivs,
    followUpsUsed: 0, followUpLimit: 1, asked: plan.questions.slice(0, t.q + 1).map((x) => x.text).slice(-6), upcoming: plan.questions.slice(t.q + 1, t.q + 3).map((x) => x.text),
    jdFacts: facts, next: nq ? { stage: nq.stage, askedBy: nq.askedBy, draft: nq.text, intent: nq.intent } : undefined,
  };
  const r = await call(buildScoreMessages(req));
  cost += r.cost;
  const p = ScoreSchema.safeParse(parseModelJson(r.content));
  if (!p.success) {
    const raw = parseModelJson(r.content);
    console.log(`turn ${t.q}: ${r.status} invalid reply: ${raw ? p.error.issues.slice(0, 3).map((i) => `${i.path.join('.')} ${i.message}`).join('; ') : 'no JSON ' + r.content.slice(0, 200)}`);
    continue;
  }
  history.push(p.data.summary);
  const src = questionSource(req);
  const add = (kind: string, text: string | undefined) => {
    if (!text) return;
    rows.push({ kind, text, grounded: groundedQuestion(text, src, 'ko'), linked: LINK.test(text), multi: MULTI.test(text), len: text.length });
  };
  console.log(`\n[Q${t.q}] ${q.text}\n[A] ${t.answer}`);
  // What the candidate sees: with the server checks on, a rejected rewrite falls back to the draft and a rejected follow-up is skipped.
  const fu = p.data.followUp?.needed ? p.data.followUp.text : '';
  const fuShown = fu && (!CHECKS || groundedQuestion(fu, src, 'ko')) ? fu : '';
  if (fu) console.log(`  꼬리질문${fuShown ? '' : ' (서버가 거름)'}: ${fu}`), fuShown && add('followUp', fuShown);
  if (nq) {
    const kept = CHECKS ? usableNext(req, p.data.next, fuShown || undefined) : p.data.next;
    const shown = kept?.text ?? nq.text;
    console.log(`  다음 초안: ${nq.text}\n  다음(AI): ${p.data.next?.text ?? '(없음)'}${kept ? '' : '  → 초안 사용'}`);
    add('next', shown);
  }
}
const pct = (f: (r: (typeof rows)[number]) => boolean) => `${Math.round((rows.filter(f).length / Math.max(1, rows.length)) * 100)}%`;
console.log(`\n${model} · ${rows.length} questions · $${cost.toFixed(5)}`);
console.log(`grounded (no bare or invented figure): ${pct((r) => r.grounded)}  linked to the answer/transition: ${pct((r) => r.linked)}  one ask: ${pct((r) => !r.multi)}  ≤110 chars: ${pct((r) => r.len <= 110)}  avg length: ${Math.round(rows.reduce((a, r) => a + r.len, 0) / Math.max(1, rows.length))}`);
