import type { Chunk, DocKind, InterviewerConfig, Lang, Plan, Question, Stage } from '../../shared/schema';
import { assignInterviewers } from './assign';

export const STAGE_PLAN: Stage[] = ['intro', 'motivation', 'experience', 'experience', 'experience', 'competency', 'competency', 'company', 'situational', 'reverse', 'closing'];
/** Quick interview: the bank's introduction, then two questions the turn calls rewrite from the answers. */
export const QUICK_STAGES: Stage[] = ['intro', 'experience', 'competency'];

type T = { text: string; intent: string; mustHit: string[]; redFlags: string[]; outline: string; seeds: [string, string] };
type Ctx = { company: string; role: string; quote: string; where: string; career: 'new' | 'exp' };

const KO: Record<Stage, ((c: Ctx) => T)[]> = {
  intro: [(c) => ({ text: '먼저 1분 정도로 자기소개 부탁드립니다.', intent: '핵심 경력과 지원 직무의 연결을 빠르게 파악', mustHit: ['경력', c.role, '강점'], redFlags: ['태어나', '성실한 사람'], outline: '한 줄 정체성 → 대표 성과 1~2개(수치) → 이 직무에 기여할 점', seeds: ['그중 가장 자랑하고 싶은 성과 하나만 더 자세히 말씀해 주세요.', '본인을 한 단어로 표현하면요?'] })],
  motivation: [(c) => ({ text: c.career === 'exp' ? `이직을 결심하신 이유와 ${c.company}에 지원하신 이유를 말씀해 주세요.` : `${c.company}에 지원하신 이유가 궁금합니다.`, intent: '지원 동기의 진정성과 회사 이해도', mustHit: [c.company, '직무', '기여'], redFlags: ['연봉', '안정적', '집이 가까'], outline: '회사·직무에 끌린 구체적 이유 → 나의 경험과의 접점 → 입사 후 기여', seeds: ['다른 회사도 지원하셨나요? 그중 저희를 택한 이유는요?', '입사 후 1년 안에 이루고 싶은 것은요?'] })],
  experience: [
    (c) => ({ text: c.quote ? `${koLead(c)}이 일에서 본인이 직접 맡은 역할과, 그 결과를 어떻게 측정하셨는지 순서대로 설명해 주시겠어요?` : '지금까지 하신 일 중 성과가 가장 컸던 프로젝트 하나를 골라, 어떤 상황에서 무엇을 맡으셨는지부터 말씀해 주시겠어요?', intent: '이력서 주장의 사실 여부와 개인 기여 검증', mustHit: ['본인 역할', '수치', '과정'], redFlags: ['우리 팀이', '다 같이'], outline: '상황 → 내가 맡은 일 → 의사결정 근거 → 수치 결과 → 배운 점', seeds: ['그 수치는 어떻게 측정하셨나요?', '다시 한다면 무엇을 다르게 하시겠어요?'] }),
    (c) => ({ text: c.quote ? `${koLead(c)}그 결과를 내기까지 가장 어려웠던 문제는 무엇이었고, 어떻게 푸셨나요?` : '일하면서 부딪힌 가장 어려운 문제 하나와, 그걸 어떻게 푸셨는지 말씀해 주세요.', intent: '문제 해결 방식과 깊이', mustHit: ['문제', '원인', '해결'], redFlags: ['운이 좋'], outline: '문제 정의 → 원인 분석 → 대안 비교 → 실행 → 결과', seeds: ['다른 대안은 왜 버리셨나요?', '그 결정에 반대한 사람은 없었나요?'] }),
    (c) => ({ text: c.quote ? `${koLead(c)}팀이 함께 낸 성과였을 텐데, 그중 본인 몫이라고 할 수 있는 부분과 그 근거는 무엇인가요?` : '팀으로 낸 성과 가운데 본인 몫이라고 할 수 있는 부분과 그 근거를 말씀해 주세요.', intent: '성과 귀속의 정직성', mustHit: ['기여', '근거', '협업'], redFlags: ['제가 다 했'], outline: '팀 성과와 내 몫 구분 → 객관적 근거 → 협업 인정', seeds: ['동료들은 당신의 기여를 어떻게 평가할까요?', '실패했던 부분은 없나요?'] }),
  ],
  competency: [
    (c) => ({ text: `${c.role} 직무에서 가장 자신 있는 역량을 실제 사례로 말씀해 주세요.`, intent: '직무 핵심 역량 보유 여부', mustHit: ['사례', '결과', '역량'], redFlags: ['열심히', '최선을'], outline: '역량 한 줄 → 사례(STAR) → 이 회사에서의 적용', seeds: ['그 역량이 부족했던 순간은 언제였나요?', '그걸 어떻게 키우셨나요?'] }),
    (c) => ({ text: `공고의 자격요건 중 본인에게 가장 부족한 부분은 무엇이고, 어떻게 보완하실 건가요?`, intent: '자기 객관화와 학습 계획', mustHit: ['부족', '보완', '계획'], redFlags: ['없습니다'], outline: '솔직한 약점 → 이미 하고 있는 보완 → 입사 후 계획', seeds: ['그 보완 계획의 첫 30일은요?', '비슷한 걸 빨리 익힌 경험이 있나요?'] }),
  ],
  company: [(c) => ({ text: `${c.company}가 앞으로 1~2년 동안 가장 집중해야 할 과제는 무엇이라고 보시나요?`, intent: '회사·산업 이해와 관점', mustHit: ['시장', '과제', '기여'], redFlags: ['잘 모르'], outline: '시장 변화 → 회사의 과제 → 내가 기여할 방법', seeds: ['그 과제를 위해 첫 3개월에 무엇을 하시겠어요?', '경쟁사는 어떻게 보시나요?'] })],
  situational: [() => ({ text: '동료나 상사와 의견이 크게 부딪혔던 경험과 해결 과정을 말씀해 주세요.', intent: '갈등 관리와 협업 태도', mustHit: ['갈등', '대화', '결과'], redFlags: ['상대가 틀', '참았'], outline: '상황 → 상대 입장 이해 → 합의 방식 → 결과와 관계', seeds: ['결국 누구의 의견대로 됐나요?', '지금이라면 어떻게 하시겠어요?'] })],
  reverse: [() => ({ text: '마지막으로 저희에게 궁금한 점 있으신가요?', intent: '관심도와 질문의 질', mustHit: ['팀', '업무'], redFlags: ['연봉', '야근'], outline: '직무·팀·성과 기준에 대한 구체적 질문 1~2개', seeds: ['다른 궁금한 점은요?', '그 질문을 하신 이유는요?'] })],
  closing: [() => ({ text: '마지막으로 하고 싶은 말씀 있으시면 편하게 해주세요.', intent: '마무리 인상', mustHit: ['기여', '각오'], redFlags: ['뽑아만'], outline: '핵심 강점 한 줄 재강조 → 감사 인사', seeds: ['', ''] })],
};

/** "오늘장보기에 계실 때 "…"라고 적어 주셨는데요. ": the claim with where it happened, so the question needs no guessing. */
const koLead = (c: Ctx) => `${c.where} ${quoteKo(c.quote)} 적어 주셨는데요. `;
const enLead = (c: Ctx) => `${c.where}, you note "${c.quote}". `;

const EN: Record<Stage, ((c: Ctx) => T)[]> = {
  intro: [(c) => ({ text: 'Could you start by telling us about yourself in about a minute?', intent: 'Quick read on background and fit', mustHit: ['experience', c.role, 'strength'], redFlags: ['born in'], outline: 'One-line identity → 1–2 key results (numbers) → value for this role', seeds: ['Tell me more about the result you are proudest of.', 'How would you describe yourself in one word?'] })],
  motivation: [(c) => ({ text: c.career === 'exp' ? `Why are you leaving your current job, and why ${c.company}?` : `Why do you want to join ${c.company}?`, intent: 'Genuine motivation and company understanding', mustHit: [c.company, 'role', 'contribute'], redFlags: ['salary', 'stable'], outline: 'Specific pull → link to my experience → how I will contribute', seeds: ['Which other companies are you considering?', 'What do you want to achieve in your first year?'] })],
  experience: [
    (c) => ({ text: c.quote ? `${enLead(c)}What was your own part in that, and how did you measure the result?` : 'Pick the project you are proudest of. What was the situation, and what did you own?', intent: 'Verify the claim and personal contribution', mustHit: ['my role', 'numbers', 'process'], redFlags: ['we all'], outline: 'Situation → my task → decisions → measurable result → learning', seeds: ['How did you measure that?', 'What would you do differently?'] }),
    (c) => ({ text: c.quote ? `${enLead(c)}What was the hardest problem along the way, and how did you solve it?` : 'Tell us about the hardest problem you faced at work and how you solved it.', intent: 'Problem-solving depth', mustHit: ['problem', 'cause', 'solution'], redFlags: ['lucky'], outline: 'Define → root cause → options → execution → result', seeds: ['Why did you reject the alternatives?', 'Did anyone disagree?'] }),
    (c) => ({ text: c.quote ? `${enLead(c)}That was likely a team effort. Which part was yours, and how can you show it?` : 'Think of a team result. Which part was yours, and how can you show it?', intent: 'Honest attribution', mustHit: ['contribution', 'evidence', 'team'], redFlags: ['I did everything'], outline: 'Separate team vs. my share → objective evidence → credit others', seeds: ['How would your peers rate your contribution?', 'What did not go well?'] }),
  ],
  competency: [
    (c) => ({ text: `What is your strongest skill for this ${c.role} role? Please give a real example.`, intent: 'Core competency', mustHit: ['example', 'result', 'skill'], redFlags: ['hard-working', 'passionate'], outline: 'Skill → STAR example → how it applies here', seeds: ['When was that skill not enough?', 'How did you develop it?'] }),
    () => ({ text: 'Which requirement in the job posting are you weakest at, and how will you close the gap?', intent: 'Self-awareness and learning plan', mustHit: ['gap', 'plan', 'learning'], redFlags: ['none'], outline: 'Honest gap → what I already do → plan after joining', seeds: ['What does your first 30 days look like?', 'Have you learned something similar quickly before?'] }),
  ],
  company: [(c) => ({ text: `What do you think ${c.company} should focus on most over the next year or two?`, intent: 'Business understanding', mustHit: ['market', 'challenge', 'contribute'], redFlags: ["I don't know"], outline: 'Market shift → company challenge → my contribution', seeds: ['What would you do in your first 3 months about it?', 'How do you see the competitors?'] })],
  situational: [() => ({ text: 'Tell us about a time you strongly disagreed with a colleague or manager. How did you handle it?', intent: 'Conflict handling', mustHit: ['conflict', 'listen', 'outcome'], redFlags: ['they were wrong'], outline: 'Situation → understand their view → how we agreed → outcome', seeds: ['Whose idea won in the end?', 'What would you do now?'] })],
  reverse: [() => ({ text: 'Do you have any questions for us?', intent: 'Interest and question quality', mustHit: ['team', 'role'], redFlags: ['salary', 'overtime'], outline: '1–2 specific questions on the role, team or success criteria', seeds: ['Anything else?', 'Why do you ask?'] })],
  closing: [() => ({ text: 'Is there anything else you would like to add before we wrap up?', intent: 'Closing impression', mustHit: ['contribute'], redFlags: ['please hire me'], outline: 'Restate key strength → thanks', seeds: ['', ''] })],
};

/** The lines claims are picked from; section labels stay in so their sections can be told apart. */
const claimLines = (text: string) => text.split(/\n/).filter((l) => stripBullet(l).length > 6 || /^\s*(?:\[[^\]]+\]|#{1,3}\s)/.test(l));
const isBullet = (l: string) => /^\s*[-•·*]/.test(l);
const stripBullet = (l: string) => l.replace(/^[-•·*\s]+/, '').replace(/^\[[^\]]*\]\s*/, '').trim();
/** How much a line reads like a result: figures and result markers (%, →, 배, 명...); dates like 2019.07 ~ 2021.02 do not count. */
const claimWeight = (l: string) => {
  const noDates = l.replace(/\d{4}[.\-/]\d{1,2}(?:[.\-/]\d{1,2})?|\d{4}\s*년|\b(?:19|20)\d{2}\s*[~–-]\s*(?:(?:19|20)\d{2}|현재|present)\b|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}/g, '');
  // A result unit right after a figure (18%, 4만 명, 9분, 1.6배) or an arrow; "지원분야" holds 분 but is no result.
  return (noDates.match(/\d/g) ?? []).length + (/→|\d\s*(?:%|배|만|천|명|건|분|일|시간|원|개|x\b)/.test(noDates) ? 5 : 0);
};

/** Cut at a word boundary, never mid-word, and drop a trailing parenthetical aside when the claim stands without it. */
function tidyClaim(line: string, max: number): string {
  let s = stripBullet(line).replace(/^(?:결과|성과|실행|문제|가설|회고|내 역할|역할|result|outcome|impact|execution|my role|role)\s*[:：]\s*/i, '').replace(/[.。]$/, '');
  const noAside = s.replace(/\s*\([^()]*\)\s*$/, '');
  if (noAside.length >= 15) s = noAside;
  // One sentence: "61% → 72%. 단, CS 문의가…" quotes the first sentence that carries a result.
  const sentences = s.split(/(?<=[.。])\s+/);
  if (sentences.length > 1) s = (sentences.find((x) => claimWeight(x) >= 5) ?? sentences[0]).replace(/[.。]$/, '');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf(' '));
  return (at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[,:;·\s]+$/, '');
}

/** Skills lists and section headers are not achievements, even when they hold digits (GA4, 2021.03). */
const notClaim = (l: string, kind: DocKind = 'resume') => placeOf(l, kind) !== undefined || /^\s*(?:skills?|역량|기술|tools?|자격|학력|education)\b|^\s*\[(?:역량|기술|skills?|자격|학력)/i.test(l.trim());
// A result line is what to ask about; a problem, hypothesis or retro line describes the situation, not the achievement.
const labelBonus = (l: string) => (/^[-•·*\s]*(?:결과|성과|result|outcome|impact)\s*[:：]/i.test(l) ? 3 : /^[-•·*\s]*(?:문제|배경|가설|회고|problem|background|hypothesis|retro)\s*[:：]/i.test(l) ? -8 : 0);
const lineScore = (l: string, kind: DocKind = 'resume') => (notClaim(l, kind) ? -100 : claimWeight(l) + (isBullet(l) ? 1 : 0) + labelBonus(l));
/** Sections whose lines are never achievements, even with figures (학력 2012 ~ 2018, 기본정보 경력 5년). */
const NO_CLAIM_SECTION = /^(?:\[|#{1,3}\s*)(?:학력|역량|핵심\s*역량|스킬|기술|기본정보|인적사항|연락처|자격|자격증|교육|education|skills|contact|profile|certifications?)\b/i;
/** Each line's score with its section taken into account. */
function scoreLines(lines: string[], kind: DocKind): number[] {
  let blocked = false;
  return lines.map((l) => {
    const t = l.trim();
    if (NO_CLAIM_SECTION.test(t)) blocked = true;
    else if (placeOf(t, kind) !== undefined) blocked = false;
    return blocked ? -100 : lineScore(l, kind);
  });
}

/** Every achievement line, spread across documents: each chunk's best first, then each one's second best, and so on. */
export function claimCandidates(chunks: Chunk[]): { chunk: Chunk; pick: number }[] {
  const per = chunks
    .filter((c) => c.kind !== 'jd')
    .map((c) => {
      const lines = claimLines(c.text);
      const sc = scoreLines(lines, c.kind);
      const picks = lines.map((_, i) => ({ i, w: sc[i] })).filter((x) => x.w >= 5).sort((a, b) => b.w - a.w);
      return { c, picks };
    })
    .filter((x) => x.picks.length)
    .sort((a, b) => b.picks[0].w - a.picks[0].w);
  const out: { chunk: Chunk; pick: number }[] = [];
  for (let round = 0; out.length < 12 && per.some((x) => x.picks[round]); round++) for (const x of per) if (x.picks[round]) out.push({ chunk: x.c, pick: x.picks[round].i });
  return out;
}

/** Quote with the right particle: 이라고 after a final consonant (개선, 단축, 120), 라고 otherwise (1.6배, 21%). */
export function quoteKo(q: string): string {
  const last = q.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  const batchim = code >= 0 && code <= 11171 ? code % 28 !== 0 : /[013678]$/.test(last) || /[LMNRlmnr]$/.test(last);
  return `"${q}"${batchim ? '이라고' : '라고'}`;
}

type Place = { kind: 'company' | 'project'; name: string } | null;
const DATE = /\d{4}\s*[.\-/년]\s*\d{0,2}|\d{4}\s*[~–-]|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}/i;
const SECTION = /^(?:경력|경력사항|성과|주요\s*성과|역량|핵심\s*역량|스킬|기술|학력|연락처|자격|자격증|수상|자기소개|활동|교육|프로젝트|포트폴리오|기본정보|인적사항|요약|experience|work|employment|skills|education|contact|projects?|portfolio|summary|profile|awards|certifications?)\b/i;
const tidyName = (n: string) => n.replace(/^\d+[.)]\s*/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();

/**
 * The header a claim sits under: "[경력] 회사 (2021.03 ~ 현재) 직함", "[포트폴리오] 프로젝트", "Company (Mar 2021 – present) Title",
 * "Case study: X", a layout line "회사 | 직함 | 2021.03 ~ 현재", or a "## heading" (a project in a portfolio).
 * null = a section that is not a place (경력, 역량...); undefined = not a header at all.
 */
function placeOf(line: string, kind: DocKind = 'resume'): Place | undefined {
  const t = line.trim();
  const heading = t.match(/^#{1,3}\s+(.+)$/);
  if (heading) {
    const h = heading[1].trim();
    if (SECTION.test(h)) return null;
    if (DATE.test(h) && /[|·]/.test(h)) return placeOf(h, kind);
    return kind === 'portfolio' ? { kind: 'project', name: tidyName(h) } : null;
  }
  const tagged = t.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (tagged) {
    const [, tag, rest] = tagged;
    if (/포트폴리오|프로젝트|portfolio|project|case/i.test(tag)) return { kind: 'project', name: tidyName(rest) };
    if (/경력|경험|career|experience|work|employment/i.test(tag)) return { kind: 'company', name: rest.split(/[(|·,]/)[0].trim() };
    return null; // [역량], [학력]...: a section that is not a place
  }
  if (/^\[[^\]]+\]$/.test(t)) return null; // "[경력사항]" alone: a section label
  const labelled = t.match(/^(case study|project|프로젝트|포트폴리오)\s*[:：]\s*(.+)$/i);
  if (labelled) return { kind: 'project', name: tidyName(labelled[2]) };
  // "회사 | 직함 | 2021.03 ~ 현재" (no achievement in it): the first cell that is not a date.
  const cells = t.split(/\s+[|·]\s+/);
  if (cells.length >= 2 && DATE.test(t) && cells.every((c) => claimWeight(c) < 5)) {
    const name = cells.find((c) => !DATE.test(c) && c.length >= 2);
    if (name) return { kind: 'company', name: name.trim() };
  }
  if (!isBullet(t) && /\(\s*(?:[A-Za-z]{3,}\.?\s*)?\d{4}/.test(t)) return { kind: 'company', name: t.split('(')[0].trim() };
  return undefined;
}

/** A table row holds its own place: "2021.03 ~ 현재 | 오늘장보기 | 매니저 | 재구매율 18% → 27% 개선". */
function rowPlace(line: string): { place: Place; claim: string } | null {
  const cells = line.split(/\s+\|\s+/);
  if (cells.length < 3 || !DATE.test(line)) return null;
  const best = cells.reduce((a, b) => (claimWeight(b) > claimWeight(a) ? b : a));
  const name = cells.find((c) => c !== best && !DATE.test(c) && c.trim().length >= 2);
  return name ? { place: { kind: 'company', name: name.trim() }, claim: best } : null;
}

/**
 * The claim to ask about and where it comes from, so a question never throws a bare number at the candidate
 * ("35% 개선에서 기여한 부분은?") but says whose work it was ("오늘장보기에 계실 때 '…'라고 적어 주셨는데요").
 */
export function claimAnchor(text: string, lang: Lang, max = 80, pick?: number, kind: DocKind = 'resume'): { claim: string; where: string } {
  const lines = claimLines(text);
  const sc = scoreLines(lines, kind);
  const scored = lines.map((l, i) => ({ l, i, w: sc[i] }));
  const best = pick !== undefined && scored[pick] ? scored[pick] : scored.reduce((a, b) => (b.w > a.w ? b : a), scored[0] ?? { l: text, i: 0, w: 0 });
  let place: Place = null;
  let claimText = best.l;
  const row = rowPlace(best.l);
  if (row) {
    place = row.place;
    claimText = row.claim;
  } else
    for (let i = best.i - 1; i >= 0; i--) {
      const p = placeOf(lines[i], kind);
      if (p !== undefined) {
        place = p;
        break;
      }
    }
  const ko = lang === 'ko';
  const where = !place?.name
    ? ko ? '이력서에' : 'On your resume'
    : place.kind === 'company'
      ? ko ? `${place.name}에 계실 때` : `At ${place.name}`
      : ko ? `포트폴리오의 '${place.name}' 프로젝트에서` : `In your "${place.name}" case study`;
  return { claim: tidyClaim(claimText, max), where };
}

/** The line in a passage that carries a claim (used where only the words are needed). */
export function claimLine(text: string, max = 60): string {
  return claimAnchor(text, 'ko', max).claim;
}

export function buildTemplatePlan(input: { lang: Lang; company: string; role: string; career: 'new' | 'exp'; interviewers: InterviewerConfig[]; chunks: Chunk[]; stages?: Stage[] }): Plan {
  const bank = input.lang === 'ko' ? KO : EN;
  const claims = claimCandidates(input.chunks);
  const used: Partial<Record<Stage, number>> = {};
  let expN = 0;
  const questions: Question[] = (input.stages ?? STAGE_PLAN).map((stage, i) => {
    const n = used[stage] ?? 0;
    used[stage] = n + 1;
    const c = stage === 'experience' && claims.length ? claims[expN++ % claims.length] : undefined;
    const ev = c?.chunk;
    const anchor = c ? claimAnchor(c.chunk.text, input.lang, 80, c.pick, c.chunk.kind) : null;
    const t = bank[stage][n % bank[stage].length]({ company: input.company, role: input.role, career: input.career, quote: anchor?.claim ?? '', where: anchor?.where ?? '' });
    return {
      id: `t${i + 1}`,
      stage,
      askedBy: assignInterviewers(stage, input.interviewers),
      text: t.text,
      intent: t.intent,
      mustHit: t.mustHit.filter(Boolean),
      redFlags: t.redFlags,
      evidenceIds: ev ? [ev.id] : [],
      answerOutline: t.outline,
      followUpSeeds: t.seeds.filter(Boolean),
    };
  });
  const ko = input.lang === 'ko';
  return {
    interviewers: input.interviewers.map((iv, i) => ({ id: iv.id, displayName: (ko ? ['김도윤', '이서연', '박준호', '최지아'] : ['Alex Morgan', 'Jamie Lee', 'Taylor Kim', 'Jordan Park'])[i % 4], title: '', greeting: ko ? '반갑습니다.' : 'Nice to meet you.' })),
    smallTalk: {
      opening: ko ? ['오시는 길은 괜찮으셨어요?', '긴장 푸시고 평소처럼 편하게 말씀해 주세요.'] : ['How was your trip here today?', 'Please relax. Think of this as a conversation.'],
      transitions: ko ? ['좋습니다. 다음 질문 드릴게요.', '네, 이어서 여쭤보겠습니다.', '알겠습니다. 주제를 조금 바꿔볼게요.'] : ['Great, next question.', 'Okay, let us move on.', 'Alright, switching topics a little.'],
      acknowledgements: ko ? ['네, 그렇군요.', '음, 알겠습니다.', '좋네요.', '흥미롭네요.'] : ['I see.', 'Got it.', 'Nice.', 'Interesting.'],
    },
    questions,
  };
}

export function fillMissing(plan: Plan, template: Plan): Plan {
  const need: Partial<Record<Stage, number>> = {};
  for (const s of STAGE_PLAN) need[s] = (need[s] ?? 0) + 1;
  const out: Question[] = [];
  const seen = new Set<string>();
  for (const stage of [...new Set(STAGE_PLAN)]) {
    const mine = plan.questions.filter((q) => q.stage === stage && !seen.has(q.id)).slice(0, need[stage]);
    const tops = template.questions.filter((q) => q.stage === stage).slice(mine.length, need[stage]);
    for (const q of [...mine, ...tops]) {
      const id = seen.has(q.id) ? `${q.id}-x` : q.id;
      seen.add(id);
      out.push({ ...q, id });
    }
  }
  return { ...plan, questions: out };
}
