import { describe, it, expect } from 'vitest';
import { AVATAR_STATES, faceFor, stateFor } from '../../src/avatar/expression';

describe('avatar states', () => {
  it('supports the six states', () => {
    expect(AVATAR_STATES).toEqual(['neutral', 'smile', 'serious', 'doubt', 'nod', 'memo']);
  });
  it('maps model expressions onto states (frown reads as serious, tilt as doubt)', () => {
    expect(stateFor('frown')).toBe('serious');
    expect(stateFor('tilt')).toBe('doubt');
    expect(stateFor('smile')).toBe('smile');
    expect(stateFor('nod')).toBe('nod');
    expect(stateFor('neutral')).toBe('neutral');
  });
  it('keeps changes calm: smile lifts the mouth, serious lowers the brows, doubt is asymmetric with a small tilt', () => {
    const n = faceFor('neutral', 0);
    expect(faceFor('smile', 0).smile).toBeGreaterThan(n.smile);
    expect(faceFor('serious', 0).browY).toBeLessThan(n.browY);
    const d = faceFor('doubt', 0);
    expect(d.browL).not.toBe(d.browR);
    expect(Math.abs(d.tilt)).toBeGreaterThan(0);
    expect(Math.abs(d.tilt)).toBeLessThanOrEqual(6);
  });
  it('memo looks down', () => {
    expect(faceFor('memo', 0).gazeY).toBeGreaterThan(0);
    expect(faceFor('memo', 0).pitch).toBeGreaterThan(0);
  });
  it('personality base shifts the resting brows', () => {
    expect(faceFor('neutral', -0.4).browY).toBeLessThan(faceFor('neutral', 0.3).browY);
  });
});
