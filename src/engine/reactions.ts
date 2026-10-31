import type { Expression, InterviewerConfig, Score } from '../../shared/schema';

export type TimedReaction = { interviewerId: string; expression: Expression; delayMs: number; line?: string };

export function bandExpression(score: number): Expression {
  if (score >= 85) return 'smile';
  if (score >= 70) return 'nod';
  if (score >= 50) return 'tilt';
  return 'frown';
}

export function correctForPersonality(e: Expression, score: number, p: InterviewerConfig['personality']): Expression {
  if (p === 'warm' && e === 'frown') return 'tilt';
  if (p === 'strict' && e === 'smile' && score < 90) return 'nod';
  if (p === 'pressure') {
    if (e === 'smile') return 'nod';
    if (e === 'tilt' && score < 70) return 'frown';
  }
  return e;
}

const hash = (n: number) => {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
};

export function adjustReactions(score: number, ivs: InterviewerConfig[], proposed?: Score['reactions']): TimedReaction[] {
  return ivs.map((iv, idx) => {
    const p = proposed?.find((x) => x.interviewerId === iv.id);
    const base = p?.expression && p.expression !== 'neutral' ? p.expression : bandExpression(score);
    return {
      interviewerId: iv.id,
      expression: correctForPersonality(base, score, iv.personality),
      delayMs: idx === 0 ? 300 : 300 + (hash(iv.seed * 31 + idx) % 501),
      line: p?.line,
    };
  });
}
