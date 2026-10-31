import { describe, it, expect } from 'vitest';
import { faceTarget, nodPitch, lerpFace } from '../../src/avatar/expression';

describe('faceTarget', () => {
  it('smile lifts mouth corners', () => expect(faceTarget('smile', 0).mouth.smile).toBeGreaterThan(0.5));
  it('frown pouts and lowers brows', () => {
    const f = faceTarget('frown', 0);
    expect(f.mouth.pout).toBeGreaterThan(0.3);
    expect(f.browY).toBeLessThan(0);
  });
  it('tilt rolls the head and makes brows asymmetric', () => {
    const t = faceTarget('tilt', 0);
    expect(t.headRoll).not.toBe(0);
    expect(t.browL).not.toBe(t.browR);
  });
  it('base brow shifts neutral', () => {
    expect(faceTarget('neutral', -0.4).browY).toBeLessThan(faceTarget('neutral', 0.3).browY);
  });
});

describe('nodPitch', () => {
  it('starts and ends at rest and oscillates ≥4 sign changes within 0.9s', () => {
    expect(nodPitch(0)).toBe(0);
    expect(nodPitch(1.2)).toBe(0);
    let changes = 0;
    let prev = 0;
    for (let t = 0.01; t < 0.9; t += 0.01) {
      const v = nodPitch(t);
      if (prev !== 0 && Math.sign(v) !== Math.sign(prev) && v !== 0) changes++;
      if (v !== 0) prev = v;
    }
    expect(changes).toBeGreaterThanOrEqual(4);
  });
});

describe('lerpFace', () => {
  it('interpolates halfway', () => {
    const a = faceTarget('neutral', 0);
    const b = faceTarget('smile', 0);
    expect(lerpFace(a, b, 0.5).mouth.smile).toBeCloseTo((a.mouth.smile + b.mouth.smile) / 2);
  });
});
