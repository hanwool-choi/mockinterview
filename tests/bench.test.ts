import { describe, it, expect } from 'vitest';
import { summarize, type TurnResult } from '../scripts/bench/metrics';

const t = (o: Partial<TurnResult>): TurnResult => ({ kind: 'turn', ok: true, ms: 1000, tokensIn: 3000, tokensOut: 700, costUsd: 0.0002, score: 70, expect: 'normal', followUp: null, next: null, nextWanted: false, ...o });

describe('benchmark metrics', () => {
  it('adds cost, tokens and latency, and counts valid replies', () => {
    const s = summarize('m', [t({}), t({ ok: false, score: null }), t({ kind: 'report', score: null })]);
    expect(s.calls).toBe(3);
    expect(s.validRate).toBeCloseTo(2 / 3);
    expect(s.costUsd).toBeCloseTo(0.0006);
    expect(s.p50Ms).toBe(1000);
  });
  it('trap gap: a strong answer must outscore an evasive one', () => {
    const s = summarize('m', [t({ expect: 'strong', score: 82 }), t({ expect: 'trap', score: 25 })]);
    expect(s.trapGap).toBe(57);
    expect(s.trapCaught).toBe(true);
    expect(summarize('m', [t({ expect: 'strong', score: 60 }), t({ expect: 'trap', score: 55 })]).trapCaught).toBe(false);
  });
  it('rates follow-ups that pick up the answer and next questions delivered when asked', () => {
    const s = summarize('m', [
      t({ followUp: '방금 61%라고 하셨는데 어떻게 측정하셨나요?', nextWanted: true, next: '다음 질문입니다?' }),
      t({ followUp: '좀 더 자세히 말씀해 주세요.', nextWanted: true, next: null }),
    ]);
    expect(s.followUpSpecificRate).toBe(0.5);
    expect(s.nextRate).toBe(0.5);
  });
  it('projects cost per full interview from the measured per-turn average', () => {
    const s = summarize('m', [t({ costUsd: 0.0002 }), t({ costUsd: 0.0004 }), t({ kind: 'report', costUsd: 0.001, score: null })]);
    expect(s.perTurnUsd).toBeCloseTo(0.0003);
    expect(s.fullInterviewUsd).toBeCloseTo(0.0003 * 16 + 0.001);
    expect(s.quickInterviewUsd).toBeCloseTo(0.0003 * 3 + 0.001);
  });
});
