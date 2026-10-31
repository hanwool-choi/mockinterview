import { describe, it, expect } from 'vitest';
import { localScore } from '../../src/engine/localScore';
import { ScoreSchema } from '../../shared/schema';
import { q } from './fixtures';

const question = q('q1', 'experience', 'a', { mustHit: ['기여', '전환율', '실험'], redFlags: ['열심히'] });

describe('localScore', () => {
  it('rewards must-hit coverage and numbers', () => {
    const good = localScore(question, '제 기여는 실험 설계였습니다. 6주간 실험 12건을 돌려 전환율을 2.1%에서 3.4%로 올렸고, 그 결과 월 매출이 18% 늘었습니다. 다만 표본이 작아 2차 검증을 했습니다.', 'ko');
    const empty = localScore(question, '', 'ko');
    expect(good.score - empty.score).toBeGreaterThanOrEqual(30);
    expect(ScoreSchema.safeParse(good).success).toBe(true);
    expect(good.local).toBe(true);
    expect(good.betterAnswer).toBe('');
  });
  it('penalizes red-flag phrases', () => {
    const base = '제 기여는 실험 설계였고 전환율을 3%p 올렸습니다. 실험은 12건이었습니다.';
    expect(localScore(question, base + ' 열심히 했습니다.', 'ko').score).toBeLessThan(localScore(question, base, 'ko').score);
    expect(localScore(question, base + ' 열심히 했습니다.', 'ko').flaggedPhrases).toEqual(['열심히']);
  });
  it('proposes the first seed as follow-up when weak', () => {
    const s = localScore(question, '음 잘 모르겠습니다', 'ko');
    expect(s.score).toBeLessThan(70);
    expect(s.followUp).toEqual({ needed: true, askedBy: 'a', text: 'f1' });
  });
  it('works for english answers', () => {
    const qe = q('q', 'competency', 'a', { mustHit: ['latency', 'cache'] });
    const s = localScore(qe, 'I cut p95 latency from 800ms to 120ms by adding a cache layer, which raised conversion 4%.', 'en');
    expect(s.rubric.jobFit).toBeGreaterThanOrEqual(14);
  });
});
