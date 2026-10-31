import type { ScoreRequest } from '../../shared/api';

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
  };
}
