import type { ReportRequest, ScoreRequest } from '../../shared/api';

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);

/** Clamp every free-text field so the request stays under LIMITS.scoreBytes even for long Korean answers. */
export function makeScoreRequest(r: ScoreRequest): ScoreRequest {
  return {
    ...r,
    question: { ...r.question, text: cut(r.question.text, 600), answerOutline: cut(r.question.answerOutline, 600), intent: cut(r.question.intent, 300) },
    answer: cut(r.answer, 4000),
    thread: r.thread.slice(-3).map((t) => ({ q: cut(t.q, 300), a: cut(t.a, 1500) })),
    evidence: r.evidence.slice(0, 4).map((c) => ({ ...c, text: cut(c.text, 600) })),
    history: r.history.slice(-6).map((h) => cut(h, 200)),
    asked: (r.asked ?? []).slice(-12).map((h) => cut(h, 160)),
    upcoming: (r.upcoming ?? []).slice(0, 10).map((h) => cut(h, 160)),
  };
}

/** The report prompt reads score, rubric, top strengths/improvements and the summary; drop the rest (betterAnswer, guide, reactions). */
export function makeReportRequest(r: ReportRequest): ReportRequest {
  return {
    ...r,
    items: r.items.slice(0, 40).map((i) => ({
      questionId: i.questionId,
      stage: i.stage,
      score: {
        score: i.score.score,
        grade: i.score.grade,
        rubric: i.score.rubric,
        strengths: i.score.strengths.slice(0, 1).map((s) => cut(s, 100)),
        improvements: i.score.improvements.slice(0, 2).map((s) => cut(s, 100)),
        flaggedPhrases: [],
        betterAnswer: '',
        followUp: null,
        reactions: [],
        summary: cut(i.score.summary, 100),
      },
    })),
  };
}
