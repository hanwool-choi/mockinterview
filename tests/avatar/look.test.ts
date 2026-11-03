import { describe, it, expect } from 'vitest';
import { lookFor } from '../../src/avatar/look';
import type { InterviewerConfig } from '../../shared/schema';

const cfg = (o: Partial<InterviewerConfig> = {}): InterviewerConfig => ({ id: 'a', role: 'dev', rank: 'staff', gender: 'female', personality: 'warm', seed: 42, ...o });

describe('lookFor: one art style, impression follows rank and role', () => {
  it('is deterministic for the same config', () => {
    expect(lookFor(cfg())).toEqual(lookFor(cfg()));
  });
  it('rank sets the age band', () => {
    expect(lookFor(cfg({ rank: 'staff' })).age).toBe('young');
    expect(lookFor(cfg({ rank: 'manager' })).age).toBe('mid');
    expect(lookFor(cfg({ rank: 'lead' })).age).toBe('mid');
    expect(lookFor(cfg({ rank: 'exec' })).age).toBe('senior');
  });
  it('executives wear a dark suit and have graying hair', () => {
    for (const gender of ['male', 'female'] as const) {
      const l = lookFor(cfg({ rank: 'exec', role: 'other', gender }));
      expect(l.outfit.kind).toBe(gender === 'male' ? 'suit' : 'blazer');
      expect(['#8e9196', '#a9acb1', '#6f7378']).toContain(l.hair.color);
    }
  });
  it('the sheet trio: exec in suit and tie, HR in a light blazer, staff in a shirt with a lanyard', () => {
    const exec = lookFor(cfg({ role: 'other', rank: 'exec', gender: 'male' }));
    expect(exec.outfit.tie).not.toBeNull();
    const hr = lookFor(cfg({ role: 'hr', rank: 'manager', gender: 'female' }));
    expect(hr.outfit.kind).toBe('blazer');
    const staff = lookFor(cfg({ role: 'dev', rank: 'staff', gender: 'male' }));
    expect(staff.outfit.kind).toBe('shirt');
    expect(staff.lanyard).toBe(true);
  });
  it('gender picks a matching hair set; unspecified gender still resolves to one', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(['shortCrop', 'sidePart', 'sweptBack']).toContain(lookFor(cfg({ gender: 'male', seed })).hair.style);
      expect(['lowBun', 'bob', 'long', 'ponytail']).toContain(lookFor(cfg({ gender: 'female', seed })).hair.style);
      expect(['male', 'female']).toContain(lookFor(cfg({ gender: 'none', seed })).gender);
    }
  });
  it('pressure interviewers start with lower brows than warm ones', () => {
    expect(lookFor(cfg({ personality: 'pressure' })).browBase).toBeLessThan(lookFor(cfg({ personality: 'warm' })).browBase);
  });
  it('honours manual skin and hair overrides', () => {
    expect(lookFor(cfg(), { skinTone: '#c68e6a', hairStyle: 'bob' })).toMatchObject({ skin: '#c68e6a', hair: { style: 'bob' } });
  });
});
