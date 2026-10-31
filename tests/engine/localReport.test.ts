import { describe, it, expect } from 'vitest';
import { localReport } from '../../src/engine/localReport';
import { localScore } from '../../src/engine/localScore';
import { ReportSchema } from '../../shared/schema';
import { q } from './fixtures';

describe('localReport', () => {
  it('builds a valid report from item scores with verdict by average', () => {
    const qs = [q('q1', 'intro', 'a', { mustHit: ['경력'] }), q('q2', 'experience', 'a', { mustHit: ['수치'] })];
    const items = [
      { questionId: 'q1', stage: 'intro' as const, score: localScore(qs[0], '음', 'ko') },
      { questionId: 'q2', stage: 'experience' as const, score: localScore(qs[1], '', 'ko') },
    ];
    const r = localReport({ items, questions: qs, interviewers: [{ id: 'a', displayName: 'A', title: '팀장' }], lang: 'ko', company: 'C', role: 'PM' });
    expect(ReportSchema.safeParse(r).success).toBe(true);
    expect(r.publicSummary.verdict).toBe('fail');
    expect(r.local).toBe(true);
    expect(r.privateDetail.nextQuestions.length).toBeGreaterThan(0);
    expect(r.privateDetail.interviewerComments[0].interviewerId).toBe('a');
  });
});
