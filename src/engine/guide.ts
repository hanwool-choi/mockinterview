import type { Guide, Lang, Question, Rubric } from '../../shared/schema';
import { claimLine } from './templates';

type Part = 'ok' | 'weak' | 'missing';
const STAR_KO = {
  situation: /당시|상황|문제|배경|이슈|때\s|때,|시절/,
  task: /역할|목표|맡|책임|담당|과제는/,
  action: /설계|정의|협의|도입|분석|만들|기획했|조율|개선했|진행했|정리했|세웠|구축|바꿨|줄이기 위해/,
  result: /결과|감소|증가|개선|단축|달성|줄었|늘었|올렸|낮췄|높였|성장/,
};
const STAR_EN = {
  situation: /\bwhen\b|at the time|problem|issue|context|situation/i,
  task: /my role|responsible|my goal|\btask\b|i owned|in charge/i,
  action: /\bi (designed|built|led|defined|ran|negotiated|analy[sz]ed|created|changed|introduced)/i,
  result: /result|reduced|increased|improved|\bcut\b|grew|raised|lowered|achieved/i,
};

export function detectStar(answer: string, lang: Lang): NonNullable<Guide['star']> {
  const re = lang === 'ko' ? STAR_KO : STAR_EN;
  const has = (k: keyof typeof re) => re[k].test(answer);
  const digits = /\d/.test(answer);
  const result: Part = has('result') ? (digits ? 'ok' : 'weak') : digits && /%|배|건|명|일|x\b/i.test(answer) ? 'weak' : 'missing';
  return { situation: has('situation') ? 'ok' : 'missing', task: has('task') ? 'ok' : 'missing', action: has('action') ? 'ok' : 'missing', result };
}

const SWAPS: Record<Lang, { re: RegExp; to: string }[]> = {
  ko: [
    { re: /(음+|어+)[.…]*/, to: '(군말 없이) 결론 한 문장으로 바로 시작' },
    { re: /팀에서 같이[^.,]*|우리 팀이[^.,]*|팀이 다[^.,]*/, to: '제가 맡은 부분은 ○○였고, 그 결과 ○○가 바뀌었습니다' },
    { re: /정확히[^.]*어렵[^.]*|잘 모르겠[^.]*/, to: '정확한 수치는 확인이 필요하지만, 제가 추적한 지표는 ○○였습니다' },
    { re: /열심히[^.,]*|최선을[^.,]*/, to: '무엇을, 몇 번, 어떻게 했는지 사실 한 문장' },
    { re: /[^.,\s]*것 같습니다/, to: '○○입니다 (근거와 함께 단정형으로)' },
  ],
  en: [
    { re: /\b(um+|uh+)\b/i, to: '(no filler) open with your conclusion' },
    { re: /\bwe (did|built|made)[^.,]*/i, to: 'I owned ___, which led to ___' },
    { re: /hard to say[^.]*|not sure[^.]*/i, to: 'I would need to confirm the exact figure, but the metric I tracked was ___' },
    { re: /hard-?working|passionate/i, to: 'one factual sentence: what, how often, how' },
    { re: /\bi think\b[^.,]*|\bmaybe\b[^.,]*/i, to: 'a direct statement with its evidence' },
  ],
};

function phraseSwaps(answer: string, q: Question, lang: Lang): Guide['phrasing'] {
  const out: Guide['phrasing'] = [];
  for (const { re, to } of SWAPS[lang]) {
    const m = answer.match(re);
    if (m) out.push({ from: m[0].trim(), to });
  }
  for (const f of q.redFlags) if (f && answer.toLowerCase().includes(f.toLowerCase()) && !out.some((o) => o.from.includes(f))) out.push({ from: f, to: lang === 'ko' ? '구체적 사실(누가, 무엇을, 얼마나)로 바꾸기' : 'replace with a concrete fact (who, what, how much)' });
  return out.slice(0, 3);
}

function fixFor(point: string, lang: Lang): Guide['fixes'][number] {
  const ko = lang === 'ko';
  if (/수치|숫자|지표|성과|number|metric|figure/i.test(point))
    return ko
      ? { point, how: '기간·규모·전후 비교 중 하나를 숫자로 말하세요. 정확하지 않으면 범위로라도 말하는 편이 낫습니다.', example: '6주 동안 실험 12건을 돌려 결제 전환율을 61%에서 72%로 올렸습니다.' }
      : { point, how: 'Give one number: time span, scale, or before/after. A range beats no number.', example: 'Over six weeks we ran 12 tests and lifted conversion from 61% to 72%.' };
  if (/역할|기여|본인|role|contribution|own/i.test(point))
    return ko
      ? { point, how: '팀 성과와 내 몫을 나누고, 내가 직접 결정한 것 한 가지를 분명히 말하세요.', example: '제가 맡은 건 정책 정의와 API 스펙 협의였고, 구현은 개발자 5명이 했습니다.' }
      : { point, how: 'Separate the team result from your share and name one decision you made.', example: 'I owned the policy and the API spec; five engineers built it.' };
  if (/경력|경험|이력|career|experience|background/i.test(point))
    return ko
      ? { point, how: '"몇 년, 어떤 도메인에서, 무엇을 해 온 사람인지"를 첫 문장에 요약하세요.', example: '예매·커머스 서비스에서 8년간 회원·결제·정산을 기획해 왔습니다.' }
      : { point, how: 'Open with one line: how many years, in which domain, doing what.', example: 'I have spent eight years planning payments and membership for ticketing and commerce.' };
  if (/강점|역량|장점|strength|skill/i.test(point))
    return ko
      ? { point, how: '강점 하나에 이름을 붙이고, 그 강점이 드러난 사례 하나를 바로 이어서 말하세요.', example: '제 강점은 이해관계자 조율입니다. 결제사 3곳의 환불 정책 차이를 62개 예외 케이스로 정리해 합의를 이끌었습니다.' }
      : { point, how: 'Name one strength and follow it immediately with one case that shows it.', example: 'My strength is aligning stakeholders: I mapped 62 refund edge cases across three payment providers.' };
  if (/동기|지원|이유|회사|기업|motivation|why|company/i.test(point))
    return ko
      ? { point, how: '회사의 구체적 사업이나 공고 문장 하나를 짚고, 그것과 맞닿는 내 경험 하나를 연결하세요.', example: '공고의 "회원·인증 정책 기획"이 제가 부정예매를 38% 줄인 인증 개편 경험과 바로 맞닿아 지원했습니다.' }
      : { point, how: 'Cite one concrete thing about the company or posting and connect one of your experiences to it.', example: 'Your posting asks for membership and auth policy; I cut fraudulent bookings 38% by redesigning ours.' };
  if (/과정|방법|어떻게|process|how/i.test(point))
    return ko
      ? { point, how: '문제 → 원인 → 선택지 → 실행 순서로 30초 안에 말하세요.', example: '로그로 원인을 확인한 뒤, 두 안 중 운영 부담이 적은 쪽을 택해 2주 만에 적용했습니다.' }
      : { point, how: 'Walk through problem → cause → options → action in 30 seconds.', example: 'Logs showed the cause; of two options I chose the cheaper one to run and shipped it in two weeks.' };
  return ko
    ? { point, how: `'${point}'을(를) 답변 안에서 한 문장으로 직접 언급하세요.`, example: `${point} 측면에서는 ○○를 했고, 그 결과 ○○였습니다.` }
    : { point, how: `Address "${point}" explicitly in one sentence.`, example: `On ${point}, I did ___, and the result was ___.` };
}

const STAR_FIX: Record<Lang, Record<keyof NonNullable<Guide['star']>, Guide['fixes'][number]>> = {
  ko: {
    situation: { point: '상황', how: '언제, 어떤 문제가 있었는지 한 문장으로 먼저 깔아 주세요.', example: '2023년 인기 공연 오픈 때마다 서버가 다운되는 문제가 있었습니다.' },
    task: { point: '내 역할', how: '그 상황에서 내가 맡은 목표나 책임을 분명히 하세요.', example: '제 역할은 대기열 정책을 정의하는 것이었습니다.' },
    action: { point: '행동', how: '내가 실제로 한 일을 동사로 2개 이상 말하세요.', example: '입장 순번 기준을 설계하고 백엔드와 토큰 API 스펙을 협의했습니다.' },
    result: { point: '결과', how: '끝에 숫자로 된 결과와 배운 점을 붙이세요.', example: '그 결과 오픈 42회 동안 장애가 0건이었습니다.' },
  },
  en: {
    situation: { point: 'Situation', how: 'Set the scene in one sentence: when, and what was wrong.', example: 'In 2023 our servers crashed at every big ticket launch.' },
    task: { point: 'Your task', how: 'State the goal or responsibility you owned.', example: 'My job was to define the queue policy.' },
    action: { point: 'Action', how: 'Name at least two things you did, with verbs.', example: 'I designed the queue rules and negotiated the token API with backend.' },
    result: { point: 'Result', how: 'End with a number and what you learned.', example: 'We had zero outages over 42 launches.' },
  },
};

const DRILL: Record<Lang, Record<keyof Rubric, string>> = {
  ko: {
    structure: '같은 질문에 "결론 한 문장 → 근거 2개 → 결과" 순서로 30초 버전을 소리 내어 말해 보세요.',
    specificity: '이 답변에 숫자 2개(기간·규모·전후 비교)를 넣어 다시 써 보세요.',
    jobFit: '채용공고의 요구 역량 한 줄을 골라, 이 경험이 그 요구와 어떻게 맞닿는지 한 문장을 덧붙여 보세요.',
    consistency: '이력서 문장과 지금 답변의 수치·역할이 일치하는지 대조하고, 다른 부분을 한 문장으로 정리해 두세요.',
    delivery: '군말(음, 약간)을 빼고 문장을 20자 안팎으로 끊어 다시 말해 보세요.',
  },
  en: {
    structure: 'Say a 30-second version: one-line conclusion, two reasons, the result.',
    specificity: 'Rewrite this answer with two numbers (time, scale, before/after).',
    jobFit: 'Pick one requirement from the posting and add a sentence tying this story to it.',
    consistency: 'Check the numbers and role against your resume and fix any mismatch.',
    delivery: 'Drop fillers and say it again in short sentences.',
  },
};

export function buildGuide(q: Question, answer: string, lang: Lang, rubric: Rubric, missing: string[], score: number, evidence?: string): Guide {
  const ko = lang === 'ko';
  const star = detectStar(answer, lang);
  const fixes = missing.slice(0, 3).map((m) => fixFor(m, lang));
  for (const k of ['result', 'action', 'task', 'situation'] as const) {
    if (fixes.length >= 3) break;
    if (star[k] !== 'ok' && !fixes.some((f) => f.point === STAR_FIX[lang][k].point)) fixes.push(STAR_FIX[lang][k]);
  }
  const weakest = (Object.keys(rubric) as (keyof Rubric)[]).reduce((a, b) => (rubric[b] < rubric[a] ? b : a));
  const gap = fixes[0]?.point ?? (ko ? '근거' : 'evidence');
  const verdict = ko
    ? score >= 80 ? '핵심과 근거가 분명해 면접관이 바로 납득할 답변입니다.'
      : score >= 60 ? `방향은 맞지만 '${gap}'이(가) 약해 확인 질문이 한 번 더 나올 답변입니다.`
      : `'${gap}'이(가) 빠져 질문을 피하는 답으로 들릴 수 있습니다.`
    : score >= 80 ? 'Clear point with evidence; the panel would accept this.'
      : score >= 60 ? `Right direction, but "${gap}" is thin, so expect a follow-up.`
      : `Without "${gap}", this can sound like you are avoiding the question.`;
  const ev = evidence ? claimLine(evidence, 70) : '';
  return {
    verdict,
    star,
    fixes,
    phrasing: phraseSwaps(answer, q, lang),
    evidence: ev ? (ko ? `이력서의 "${ev}"를 근거로 들어 답하세요.` : `Use this line from your resume as evidence: "${ev}".`) : '',
    drill: DRILL[lang][weakest],
  };
}
