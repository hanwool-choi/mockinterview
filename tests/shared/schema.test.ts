import { describe, it, expect } from 'vitest';
import { gradeOf, normalizeScore } from '../../shared/grade';
import { ScoreSchema, PlanSchema } from '../../shared/schema';

const baseScore = {
  score: 99, grade: 'S',
  rubric: { structure: 25, specificity: 10, jobFit: 10, consistency: 10, delivery: 10 },
  strengths: [], improvements: [], flaggedPhrases: [], betterAnswer: '',
  followUp: null, reactions: [], summary: 's',
};

describe('gradeOf', () => {
  it('maps boundaries S≥90 A≥80 B≥70 C≥55 D<55', () => {
    expect(gradeOf(90)).toBe('S');
    expect(gradeOf(89)).toBe('A');
    expect(gradeOf(70)).toBe('B');
    expect(gradeOf(55)).toBe('C');
    expect(gradeOf(54)).toBe('D');
  });
});

describe('normalizeScore', () => {
  it('clamps rubric to 0..20 and recomputes score and grade from the sum', () => {
    const s = normalizeScore(ScoreSchema.parse(baseScore));
    expect(s.rubric.structure).toBe(20);
    expect(s.score).toBe(60);
    expect(s.grade).toBe('C');
  });
});

describe('schemas', () => {
  it('rejects a Score missing required fields', () => {
    const { rubric, ...rest } = baseScore;
    expect(ScoreSchema.safeParse(rest).success).toBe(false);
    expect(rubric).toBeDefined();
  });
  it('accepts a minimal valid Plan', () => {
    const plan = {
      interviewers: [{ id: 'i1', displayName: '김지훈', title: '팀장', greeting: '안녕하세요' }],
      smallTalk: { opening: ['a'], transitions: ['b'], acknowledgements: ['c'] },
      questions: [{ id: 'q1', stage: 'intro', askedBy: 'i1', text: '자기소개', intent: 'x', mustHit: ['a'], redFlags: [], evidenceIds: [], answerOutline: 'o', followUpSeeds: ['f1', 'f2'] }],
    };
    expect(PlanSchema.safeParse(plan).success).toBe(true);
  });
  it('rejects an unknown expression', () => {
    const r = ScoreSchema.safeParse({ ...baseScore, reactions: [{ interviewerId: 'i1', expression: 'wink' }] });
    expect(r.success).toBe(false);
  });
});
