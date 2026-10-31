import { describe, it, expect } from 'vitest';
import { adjustReactions } from '../../src/engine/reactions';
import { iv } from './fixtures';

const one = (p: 'warm' | 'strict' | 'pressure', score: number, proposed?: 'smile' | 'nod' | 'tilt' | 'frown') =>
  adjustReactions(score, [iv('a', 'dev', 'lead', p)], proposed ? [{ interviewerId: 'a', expression: proposed }] : undefined)[0].expression;

describe('adjustReactions', () => {
  it('derives from score bands when model gives nothing', () => {
    expect(one('strict', 86)).toBe('nod'); // smile→nod for strict below 90
    expect(one('warm', 86)).toBe('smile');
    expect(one('warm', 72)).toBe('nod');
    expect(one('strict', 55)).toBe('tilt');
    expect(one('strict', 30)).toBe('frown');
  });
  it('applies personality corrections', () => {
    expect(one('warm', 40)).toBe('tilt');
    expect(one('pressure', 88)).toBe('nod');
    expect(one('strict', 92)).toBe('smile');
    expect(one('pressure', 60, 'tilt')).toBe('frown');
    expect(one('pressure', 75, 'tilt')).toBe('tilt');
  });
  it('staggers delays 300–800ms deterministically', () => {
    const ivs = [iv('a', 'dev', 'lead'), iv('bb', 'hr', 'staff'), iv('ccc', 'sales', 'exec')];
    const r1 = adjustReactions(80, ivs);
    const r2 = adjustReactions(80, ivs);
    expect(r1).toEqual(r2);
    for (const r of r1) expect(r.delayMs).toBeGreaterThanOrEqual(300), expect(r.delayMs).toBeLessThanOrEqual(800);
  });
  it('ignores proposals for unknown interviewers', () => {
    const r = adjustReactions(80, [iv('a', 'dev', 'lead')], [{ interviewerId: 'zzz', expression: 'frown' }]);
    expect(r).toHaveLength(1);
    expect(r[0].interviewerId).toBe('a');
  });
});
