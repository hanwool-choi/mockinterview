import { describe, it, expect } from 'vitest';
import { lookFor } from '../../src/avatar/look';
import type { InterviewerConfig } from '../../shared/schema';

const cfg = (o: Partial<InterviewerConfig> = {}): InterviewerConfig => ({ id: 'a', role: 'dev', rank: 'staff', gender: 'female', personality: 'warm', seed: 42, ...o });

describe('lookFor', () => {
  it('is deterministic for the same config', () => {
    expect(lookFor(cfg())).toEqual(lookFor(cfg()));
  });
  it('different seeds can vary appearance', () => {
    const looks = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => JSON.stringify(lookFor(cfg({ seed })))));
    expect(looks.size).toBeGreaterThan(1);
  });
  it('executives wear suits, gray hair and a large chair', () => {
    const l = lookFor(cfg({ rank: 'exec', role: 'other' }));
    expect(l.outfit.kind).toBe('suit');
    expect(l.chair).toBe('large');
    expect(l.ageGray).toBe(true);
  });
  it('role decides the prop', () => {
    expect(lookFor(cfg({ role: 'hr' })).prop).toBe('notebook');
    expect(lookFor(cfg({ role: 'dev' })).prop).toBe('laptop');
    expect(lookFor(cfg({ role: 'design' })).prop).toBe('tablet');
    expect(lookFor(cfg({ role: 'sales' })).prop).toBe('cards');
    expect(lookFor(cfg({ role: 'finance' })).prop).toBe('folder');
  });
  it('personality drives idle pose and brow', () => {
    const p = lookFor(cfg({ personality: 'pressure' }));
    expect(p.idle).toBe('armsCrossed');
    expect(p.browBase).toBeLessThan(0);
    expect(lookFor(cfg({ personality: 'strict' })).idle).toBe('adjustGlasses');
    expect(lookFor(cfg({ personality: 'strict' })).glasses).toBe(true);
    expect(lookFor(cfg({ personality: 'warm' })).browBase).toBeGreaterThan(0);
  });
  it('gender selects from matching hair sets', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(['short', 'side', 'bald']).toContain(lookFor(cfg({ gender: 'male', seed, rank: 'staff' })).hair.style);
      expect(['bob', 'long', 'bun', 'side']).toContain(lookFor(cfg({ gender: 'female', seed })).hair.style);
    }
  });
  it('honours manual skin and hair overrides', () => {
    expect(lookFor(cfg(), { skinTone: '#8d5524', hairStyle: 'bun' })).toMatchObject({ skin: '#8d5524', hair: { style: 'bun' } });
  });
});
