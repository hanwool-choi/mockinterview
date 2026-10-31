import type { PlanRequest, ReportRequest, ScoreRequest } from '../../shared/api';
import { gradeOf } from '../../shared/grade';
import type { Expression, Plan, Report, Score, Stage } from '../../shared/schema';

const NAMES = ['김도윤', '이서연', '박준호', '최지아'];
const NAMES_EN = ['Alex Morgan', 'Jamie Lee', 'Taylor Kim', 'Jordan Park'];

const STAGES: Stage[] = ['intro', 'motivation', 'experience', 'experience', 'experience', 'competency', 'competency', 'company', 'situational', 'reverse', 'closing'];

export function fakePlan(req: PlanRequest): Plan {
  const ko = req.lang === 'ko';
  const ivs = req.interviewers;
  const resume = req.chunks.filter((c) => c.kind !== 'jd');
  const text = (s: Stage, n: number): string => {
    const src = resume[n % Math.max(1, resume.length)]?.text ?? '';
    const line = src.split('\n').map((x) => x.replace(/^[-•\s\[\]]+|\[[^\]]*\]/g, '').trim()).find((x) => /\d/.test(x) && x.length > 8) ?? src.slice(0, 40);
    const quote = line.length > 50 ? line.slice(0, 50) : line;
    const ko_: Record<Stage, string> = {
      intro: '먼저 1분 정도 자기소개 부탁드립니다.',
      motivation: `${req.company}에 지원하신 이유가 궁금합니다.`,
      experience: `이력서에 "${quote}"라고 쓰셨는데, 본인의 기여를 수치로 설명해 주시겠어요?`,
      competency: `${req.role} 직무에서 가장 자신 있는 역량을 사례로 말씀해 주세요.`,
      company: `저희 회사가 앞으로 가장 집중해야 할 과제는 무엇이라고 보시나요?`,
      situational: '동료와 의견이 크게 부딪혔던 경험과 해결 과정을 말씀해 주세요.',
      reverse: '마지막으로 저희에게 궁금한 점 있으신가요?',
      closing: '마지막으로 하고 싶은 말씀 있으시면 해주세요.',
    };
    const en_: Record<Stage, string> = {
      intro: 'Could you start by telling us a bit about yourself?',
      motivation: `Why do you want to join ${req.company}?`,
      experience: `Your resume says "${quote}". What exactly was your contribution, in numbers?`,
      competency: `What is your strongest skill for this ${req.role} role? Give an example.`,
      company: 'What do you think our biggest challenge will be over the next year?',
      situational: 'Tell us about a time you strongly disagreed with a colleague.',
      reverse: 'Do you have any questions for us?',
      closing: 'Anything else you would like to add?',
    };
    return (ko ? ko_ : en_)[s];
  };
  return {
    interviewers: ivs.map((iv, i) => ({
      id: iv.id,
      displayName: (ko ? NAMES : NAMES_EN)[i % 4],
      title: (ko ? ['실무자', '과장', '팀장', '상무'] : ['Associate', 'Manager', 'Team Lead', 'VP'])[['staff', 'manager', 'lead', 'exec'].indexOf(iv.rank)],
      greeting: ko ? '반갑습니다. 편하게 말씀해 주세요.' : 'Nice to meet you. Please make yourself comfortable.',
    })),
    smallTalk: {
      opening: ko ? ['오시는 길은 괜찮으셨어요?', '긴장 푸시고 편하게 이야기 나눠요.'] : ['How was your trip here?', 'Relax, this is just a conversation.'],
      transitions: ko ? ['좋습니다. 다음 질문 드릴게요.', '네, 이어서 여쭤볼게요.'] : ['Great, next question.', 'Okay, moving on.'],
      acknowledgements: ko ? ['네, 그렇군요.', '음, 알겠습니다.', '좋네요.'] : ['I see.', 'Got it.', 'Nice.'],
    },
    questions: STAGES.map((stage, n) => ({
      id: `q${n + 1}`,
      stage,
      askedBy: ivs[n % ivs.length].id,
      text: text(stage, n),
      intent: ko ? '핵심 역량과 근거 확인' : 'Check core skills and evidence',
      mustHit: ko ? ['구체적 사례', '수치', '본인 역할'] : ['specific example', 'numbers', 'own role'],
      redFlags: ko ? ['열심히', '최선을'] : ['hard-working', 'passionate'],
      evidenceIds: stage === 'experience' && resume.length ? [resume[n % resume.length].id] : [],
      answerOutline: ko ? '상황 → 행동 → 수치 결과 → 배운 점' : 'Situation → Action → Result (numbers) → Learning',
      followUpSeeds: ko ? ['그 수치는 어떻게 측정하셨나요?', '다시 한다면 무엇을 바꾸시겠어요?'] : ['How did you measure that?', 'What would you do differently?'],
    })),
  };
}

const exprFor = (s: number): Expression => (s >= 85 ? 'smile' : s >= 70 ? 'nod' : s >= 50 ? 'tilt' : 'frown');

export function fakeScore(req: ScoreRequest): Score {
  const a = req.answer.trim();
  const nums = (a.match(/\d+/g) ?? []).length;
  const len = a.length;
  const r = (base: number) => Math.max(2, Math.min(20, Math.round(base)));
  const rubric = {
    structure: r(8 + Math.min(len, 300) / 25),
    specificity: r(5 + nums * 4),
    jobFit: r(len > 60 ? 13 + req.question.mustHit.filter((m) => a.includes(m)).length * 3 : 6),
    consistency: 15,
    delivery: r(6 + Math.min(len, 300) / 25),
  };
  const score = Object.values(rubric).reduce((x, y) => x + y, 0);
  const ko = req.lang === 'ko';
  const needed = score < 70 && req.followUpsUsed < req.followUpLimit;
  return {
    score,
    grade: gradeOf(score),
    rubric,
    strengths: [ko ? '질문 의도에 맞춰 답변을 시작했습니다.' : 'You addressed the question directly.'],
    improvements: [nums ? (ko ? '결과의 의미를 한 문장 더 설명하세요.' : 'Explain what the result meant.') : ko ? '수치나 구체적 근거를 넣어 주세요.' : 'Add numbers or concrete evidence.'],
    flaggedPhrases: req.question.redFlags.filter((f) => a.includes(f)),
    betterAnswer: ko ? `[예시] ${a.slice(0, 120)} … 그 결과 핵심 지표가 [본인 확인]% 개선됐습니다.` : `[Example] ${a.slice(0, 120)} … As a result the key metric improved by [verify]%.`,
    followUp: needed ? { needed: true, askedBy: req.question.askedBy, text: req.question.followUpSeeds[0] ?? (ko ? '조금 더 구체적으로 말씀해 주시겠어요?' : 'Could you be more specific?') } : null,
    reactions: req.interviewers.map((iv) => ({ interviewerId: iv.id, expression: exprFor(score) })),
    summary: a.slice(0, 60),
  };
}

export function fakeReport(req: ReportRequest): Report {
  const avg = Math.round(req.items.reduce((n, i) => n + i.score.score, 0) / Math.max(1, req.items.length));
  const ko = req.lang === 'ko';
  const verdict = avg >= 75 ? 'pass' : avg >= 60 ? 'hold' : 'fail';
  return {
    publicSummary: { company: req.company, role: req.role, grade: gradeOf(avg), score: avg, verdict, oneLiner: ko ? '근거를 갖춘 답변이 돋보였습니다.' : 'Evidence-backed answers stood out.' },
    privateDetail: {
      verdictReason: ko ? `평균 ${avg}점으로 ${verdict === 'pass' ? '합격' : verdict === 'hold' ? '보류' : '불합격'} 성향입니다.` : `Average ${avg} → ${verdict}.`,
      interviewerComments: req.interviewers.map((i) => ({ interviewerId: i.id, comment: ko ? '전반적으로 성실한 답변이었습니다.' : 'Solid, sincere answers overall.' })),
      top3Strengths: ko ? ['질문 의도 파악', '침착한 태도', '경험의 연결'] : ['Understood intent', 'Calm delivery', 'Connected experience'],
      top3Fixes: ko ? ['결론부터 말하기', '수치 근거 추가', '회사와 연결하기'] : ['Lead with the conclusion', 'Add numbers', 'Tie answers to the company'],
      nextQuestions: ko ? ['입사 후 90일 계획은?', '가장 큰 실패는?', '왜 지금 이직인가?'] : ['Your first 90 days?', 'Biggest failure?', 'Why now?'],
    },
  };
}
