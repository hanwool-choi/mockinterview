import { describe, it, expect } from 'vitest';
import { buildTemplatePlan, fillMissing, STAGE_PLAN } from '../../src/engine/templates';
import { PlanSchema } from '../../shared/schema';
import { iv } from './fixtures';

const chunks = [
  { id: 'resume#1', kind: 'resume' as const, text: '커머스 앱 MAU를 1년 만에 20배 성장시킨 그로스 리드. 실험 120건.' },
  { id: 'resume#2', kind: 'resume' as const, text: '협업 툴 도입' },
  { id: 'jd#1', kind: 'jd' as const, text: '자격요건: 데이터 기반 의사결정' },
];
const input = { lang: 'ko' as const, company: '테스트', role: 'PM', career: 'exp' as const, interviewers: [iv('a', 'dev', 'staff'), iv('h', 'hr', 'lead')], chunks };

describe('buildTemplatePlan', () => {
  it('produces a valid 11-question plan grounded in resume chunks', () => {
    const p = buildTemplatePlan(input);
    expect(PlanSchema.safeParse(p).success).toBe(true);
    expect(p.questions).toHaveLength(11);
    expect(p.questions.map((x) => x.stage)).toEqual(STAGE_PLAN);
    const exp = p.questions.filter((x) => x.stage === 'experience');
    expect(exp[0].evidenceIds).toEqual(['resume#1']);
    expect(exp[0].text).toContain('20배');
  });
  it('english template is in english', () => {
    const p = buildTemplatePlan({ ...input, lang: 'en' });
    expect(p.questions[0].text).toMatch(/yourself/i);
  });
});

describe('fillMissing', () => {
  it('tops up stages to the spec counts from the template', () => {
    const t = buildTemplatePlan(input);
    const partial = { ...t, questions: t.questions.filter((x) => x.stage !== 'experience').concat(t.questions.find((x) => x.stage === 'experience')!) };
    const filled = fillMissing(partial, t);
    expect(filled.questions.map((x) => x.stage)).toEqual(STAGE_PLAN);
    expect(new Set(filled.questions.map((x) => x.id)).size).toBe(11);
  });
});
