import type { ReportRequest, ScoreRequest } from '../../shared/api';

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);

/** Clamp every free-text field so the request stays under LIMITS.scoreBytes even for long Korean answers. */
export function makeScoreRequest(r: ScoreRequest): ScoreRequest {
  // Only what this turn needs: the current exchange, short summaries of earlier answers, the few resume
  // passages that match, the posting's key lines and the next question's draft. Never the whole conversation.
  return {
    ...r,
    question: { ...r.question, text: cut(r.question.text, 600), answerOutline: cut(r.question.answerOutline, 300), intent: cut(r.question.intent, 200), followUpSeeds: r.question.followUpSeeds.slice(0, 2) },
    answer: cut(r.answer, 3000),
    thread: r.thread.slice(-2).map((t) => ({ q: cut(t.q, 300), a: cut(t.a, 1000) })),
    evidence: r.evidence.slice(0, 3).map((c) => ({ ...c, text: cut(c.text, 500) })),
    history: r.history.slice(-4).map((h) => cut(h, 160)),
    asked: (r.asked ?? []).slice(-6).map((h) => cut(h, 140)),
    upcoming: (r.upcoming ?? []).slice(0, 2).map((h) => cut(h, 140)),
    jdFacts: r.jdFacts ? cut(r.jdFacts, 700) : undefined,
    next: r.next ? { ...r.next, draft: cut(r.next.draft, 300), intent: cut(r.next.intent, 160) } : undefined,
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
