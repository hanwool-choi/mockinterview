/** Pure scoring of a benchmark run (tested in tests/bench.test.ts). */
export type TurnResult = {
  kind: 'turn' | 'report';
  ok: boolean;
  ms: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  score: number | null;
  /** What a good evaluator should do with this answer. */
  expect: 'strong' | 'trap' | 'normal';
  followUp: string | null;
  next: string | null;
  nextWanted: boolean;
};

export type Summary = {
  model: string;
  calls: number;
  validRate: number;
  p50Ms: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  perTurnUsd: number;
  quickInterviewUsd: number;
  fullInterviewUsd: number;
  trapGap: number | null;
  trapCaught: boolean;
  followUpSpecificRate: number | null;
  nextRate: number | null;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** A follow-up that refers back to what was just said ("방금 …", "You mentioned …") rather than a generic prompt. */
const SPECIFIC = /방금|말씀하신|하셨는데|라고 하셨|you mentioned|you said|earlier you/i;

export function summarize(model: string, rs: TurnResult[]): Summary {
  const turns = rs.filter((r) => r.kind === 'turn');
  const reports = rs.filter((r) => r.kind === 'report');
  const strong = turns.filter((r) => r.expect === 'strong' && r.score != null).map((r) => r.score!);
  const trap = turns.filter((r) => r.expect === 'trap' && r.score != null).map((r) => r.score!);
  const trapGap = strong.length && trap.length ? Math.round(avg(strong) - avg(trap)) : null;
  const fus = turns.map((r) => r.followUp).filter((x): x is string => !!x);
  const wanted = turns.filter((r) => r.nextWanted);
  const perTurnUsd = avg(turns.map((r) => r.costUsd));
  const reportUsd = avg(reports.map((r) => r.costUsd));
  return {
    model,
    calls: rs.length,
    validRate: rs.length ? rs.filter((r) => r.ok).length / rs.length : 0,
    p50Ms: median(rs.map((r) => r.ms)),
    tokensIn: rs.reduce((n, r) => n + r.tokensIn, 0),
    tokensOut: rs.reduce((n, r) => n + r.tokensOut, 0),
    costUsd: rs.reduce((n, r) => n + r.costUsd, 0),
    perTurnUsd,
    // quick: 3 turns + short summary; full: up to 16 turns (10 + 6 follow-ups) + report.
    quickInterviewUsd: perTurnUsd * 3 + reportUsd,
    fullInterviewUsd: perTurnUsd * 16 + reportUsd,
    trapGap,
    trapCaught: trapGap != null && trapGap >= 20,
    followUpSpecificRate: fus.length ? fus.filter((f) => SPECIFIC.test(f)).length / fus.length : null,
    nextRate: wanted.length ? wanted.filter((r) => !!r.next).length / wanted.length : null,
  };
}
