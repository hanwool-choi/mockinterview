import { buildGuide } from '../../src/engine/guide';
import type { ReportRequest, ScoreRequest } from '../../shared/api';
import { gradeOf } from '../../shared/grade';
import type { Expression, Report, Score } from '../../shared/schema';

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
    next: req.next ? { text: req.next.draft, intent: req.next.intent } : null,
    guide: buildGuide(req.question, a, req.lang, rubric, req.question.mustHit.filter((m) => !a.includes(m)), score, req.evidence[0]?.text),
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
