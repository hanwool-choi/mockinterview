import type { Grade, Rubric, Score } from './schema';

export function gradeOf(score: number): Grade {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

const clamp20 = (n: number) => Math.max(0, Math.min(20, Math.round(Number.isFinite(n) ? n : 0)));

export function rubricSum(r: Rubric): number {
  return r.structure + r.specificity + r.jobFit + r.consistency + r.delivery;
}

export function normalizeScore(s: Score): Score {
  const rubric: Rubric = {
    structure: clamp20(s.rubric.structure),
    specificity: clamp20(s.rubric.specificity),
    jobFit: clamp20(s.rubric.jobFit),
    consistency: clamp20(s.rubric.consistency),
    delivery: clamp20(s.rubric.delivery),
  };
  const score = rubricSum(rubric);
  const guide = s.guide && { ...s.guide, fixes: s.guide.fixes.slice(0, 3), phrasing: s.guide.phrasing.slice(0, 3) };
  return { ...s, rubric, score, grade: gradeOf(score), ...(guide ? { guide } : {}) };
}
