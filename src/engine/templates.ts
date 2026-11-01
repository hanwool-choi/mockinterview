import type { Chunk, InterviewerConfig, Lang, Plan, Question, Stage } from '../../shared/schema';
import { assignInterviewers } from './assign';

export const STAGE_PLAN: Stage[] = ['intro', 'motivation', 'experience', 'experience', 'experience', 'competency', 'competency', 'company', 'situational', 'reverse', 'closing'];

type T = { text: string; intent: string; mustHit: string[]; redFlags: string[]; outline: string; seeds: [string, string] };
type Ctx = { company: string; role: string; quote: string; career: 'new' | 'exp' };

const KO: Record<Stage, ((c: Ctx) => T)[]> = {
  intro: [(c) => ({ text: '먼저 1분 정도로 자기소개 부탁드립니다.', intent: '핵심 경력과 지원 직무의 연결을 빠르게 파악', mustHit: ['경력', c.role, '강점'], redFlags: ['태어나', '성실한 사람'], outline: '한 줄 정체성 → 대표 성과 1~2개(수치) → 이 직무에 기여할 점', seeds: ['그중 가장 자랑하고 싶은 성과 하나만 더 자세히 말씀해 주세요.', '본인을 한 단어로 표현하면요?'] })],
  motivation: [(c) => ({ text: c.career === 'exp' ? `이직을 결심하신 이유와 ${c.company}에 지원하신 이유를 말씀해 주세요.` : `${c.company}에 지원하신 이유가 궁금합니다.`, intent: '지원 동기의 진정성과 회사 이해도', mustHit: [c.company, '직무', '기여'], redFlags: ['연봉', '안정적', '집이 가까'], outline: '회사·직무에 끌린 구체적 이유 → 나의 경험과의 접점 → 입사 후 기여', seeds: ['다른 회사도 지원하셨나요? 그중 저희를 택한 이유는요?', '입사 후 1년 안에 이루고 싶은 것은요?'] })],
  experience: [
    (c) => ({ text: `이력서에 "${c.quote}"라고 쓰셨는데, 그중 본인이 직접 한 일과 기여도를 수치로 설명해 주시겠어요?`, intent: '이력서 주장의 사실 여부와 개인 기여 검증', mustHit: ['본인 역할', '수치', '과정'], redFlags: ['우리 팀이', '다 같이'], outline: '상황 → 내가 맡은 일 → 의사결정 근거 → 수치 결과 → 배운 점', seeds: ['그 수치는 어떻게 측정하셨나요?', '다시 한다면 무엇을 다르게 하시겠어요?'] }),
    (c) => ({ text: `"${c.quote}" 과정에서 가장 어려웠던 문제와 해결 방법은 무엇이었나요?`, intent: '문제 해결 방식과 깊이', mustHit: ['문제', '원인', '해결'], redFlags: ['운이 좋'], outline: '문제 정의 → 원인 분석 → 대안 비교 → 실행 → 결과', seeds: ['다른 대안은 왜 버리셨나요?', '그 결정에 반대한 사람은 없었나요?'] }),
    (c) => ({ text: `"${c.quote}"의 성과가 본인 덕분이라고 할 수 있는 근거는 무엇인가요?`, intent: '성과 귀속의 정직성', mustHit: ['기여', '근거', '협업'], redFlags: ['제가 다 했'], outline: '팀 성과와 내 몫 구분 → 객관적 근거 → 협업 인정', seeds: ['동료들은 당신의 기여를 어떻게 평가할까요?', '실패했던 부분은 없나요?'] }),
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

const EN: Record<Stage, ((c: Ctx) => T)[]> = {
  intro: [(c) => ({ text: 'Could you start by telling us about yourself in about a minute?', intent: 'Quick read on background and fit', mustHit: ['experience', c.role, 'strength'], redFlags: ['born in'], outline: 'One-line identity → 1–2 key results (numbers) → value for this role', seeds: ['Tell me more about the result you are proudest of.', 'How would you describe yourself in one word?'] })],
  motivation: [(c) => ({ text: c.career === 'exp' ? `Why are you leaving your current job, and why ${c.company}?` : `Why do you want to join ${c.company}?`, intent: 'Genuine motivation and company understanding', mustHit: [c.company, 'role', 'contribute'], redFlags: ['salary', 'stable'], outline: 'Specific pull → link to my experience → how I will contribute', seeds: ['Which other companies are you considering?', 'What do you want to achieve in your first year?'] })],
  experience: [
    (c) => ({ text: `Your resume says "${c.quote}". What exactly did you do, and what was your contribution in numbers?`, intent: 'Verify the claim and personal contribution', mustHit: ['my role', 'numbers', 'process'], redFlags: ['we all'], outline: 'Situation → my task → decisions → measurable result → learning', seeds: ['How did you measure that?', 'What would you do differently?'] }),
    (c) => ({ text: `What was the hardest problem behind "${c.quote}", and how did you solve it?`, intent: 'Problem-solving depth', mustHit: ['problem', 'cause', 'solution'], redFlags: ['lucky'], outline: 'Define → root cause → options → execution → result', seeds: ['Why did you reject the alternatives?', 'Did anyone disagree?'] }),
    (c) => ({ text: `How can you show that the result of "${c.quote}" was due to you?`, intent: 'Honest attribution', mustHit: ['contribution', 'evidence', 'team'], redFlags: ['I did everything'], outline: 'Separate team vs. my share → objective evidence → credit others', seeds: ['How would your peers rate your contribution?', 'What did not go well?'] }),
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

/** The line in a passage that carries a claim: most figures wins, bullets and section tags stripped. */
export function claimLine(text: string, max = 60): string {
  const lines = text.split(/\n|(?<=[.!?。])\s/).map((l) => l.replace(/^[-•·\s]+/, '').replace(/^\[[^\]]*\]\s*/, '').trim()).filter((l) => l.length > 6);
  // A claim line carries results (%, →, 배, 명, 건...); dates like 2019.07 ~ 2021.02 are not claims.
  const weight = (l: string) => {
    const noDates = l.replace(/\d{4}[.\-/]\d{1,2}(?:[.\-/]\d{1,2})?|\d{4}\s*년/g, '');
    return (noDates.match(/\d/g) ?? []).length + (/[%→]|배|명|건|분|일|시간|원/.test(noDates) ? 5 : 0);
  };
  const best = lines.reduce((a, b) => (weight(b) > weight(a) ? b : a), lines[0] ?? text.trim());
  const s = best.replace(/[.。]$/, '');
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function claimChunks(chunks: Chunk[]): Chunk[] {
  const docs = chunks.filter((c) => c.kind !== 'jd');
  const digits = (c: Chunk) => (c.text.match(/\d/g) ?? []).length;
  return [...docs].sort((a, b) => digits(b) - digits(a));
}

export function buildTemplatePlan(input: { lang: Lang; company: string; role: string; career: 'new' | 'exp'; interviewers: InterviewerConfig[]; chunks: Chunk[] }): Plan {
  const bank = input.lang === 'ko' ? KO : EN;
  const claims = claimChunks(input.chunks);
  const used: Partial<Record<Stage, number>> = {};
  let expN = 0;
  const questions: Question[] = STAGE_PLAN.map((stage, i) => {
    const n = used[stage] ?? 0;
    used[stage] = n + 1;
    const ev = stage === 'experience' ? claims[expN++ % Math.max(1, claims.length)] : undefined;
    const fallbackQuote = input.lang === 'ko' ? '가장 큰 성과를 낸 프로젝트' : 'your most impactful project';
    const t = bank[stage][n % bank[stage].length]({ company: input.company, role: input.role, career: input.career, quote: ev ? claimLine(ev.text) : fallbackQuote });
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
