import { describe, it, expect } from 'vitest';
import { routeStations } from '../../src/landing/route';
import { buildTemplatePlan } from '../../src/engine/templates';

const plan = buildTemplatePlan({ lang: 'ko', company: 'C', role: 'PM', career: 'exp', interviewers: [{ id: 'a', role: 'hr', rank: 'lead', gender: 'none', personality: 'warm', seed: 1 }], chunks: [] });

describe('routeStations', () => {
  it('gives the app the same 12 named stations as the landing, icebreak first', () => {
    const s = routeStations(plan, 'ko');
    expect(s).toHaveLength(12);
    expect(s[0]).toMatchObject({ id: 'icebreak', label: '아이스브레이킹' });
    expect(s.slice(3, 6).map((x) => x.label)).toEqual(['성과 검증', '문제 해결', '기여도']);
    expect(s.slice(3, 6).every((x) => x.transfer)).toBe(true);
    expect(s[1].id).toBe(plan.questions[0].id);
  });
  it('uses the screen language', () => {
    expect(routeStations(plan, 'en')[6].label).toBe('Core skill');
  });
});
