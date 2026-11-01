import { describe, it, expect } from 'vitest';
import { budgetChunks, chunkDoc } from '../src/docs/chunk';
import { LIMITS } from '../shared/api';
import { initialState, reduce } from '../src/engine/machine';
import { makeScoreRequest } from '../src/state/requests';
import type { Plan } from '../shared/schema';

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('review fix: byte budget for Korean documents', () => {
  it('keeps a huge Korean upload (incl. JD) under the plan byte limit', () => {
    const big = (n: number) => '한국어 포트폴리오 문장입니다. '.repeat(n);
    const chunks = [...chunkDoc('jd', big(4000)), ...chunkDoc('resume', big(3000)), ...chunkDoc('portfolio', big(6000))];
    const out = budgetChunks(chunks, LIMITS.docBytes, '포트폴리오');
    const payload = JSON.stringify({ sid: 'x'.repeat(24), lang: 'ko', company: '회사', role: '직무', career: 'exp', years: 3, interviewers: [], chunks: out });
    expect(bytes(payload)).toBeLessThan(LIMITS.planBytes);
    expect(out.some((c) => c.kind === 'jd')).toBe(true);
  });
});

describe('review fix: score request stays under the byte limit', () => {
  it('caps answer, thread and evidence for worst-case Korean input', () => {
    const long = '가'.repeat(6000);
    const req = makeScoreRequest({
      sid: 's', lang: 'ko', question: { id: 'q', stage: 'experience', askedBy: 'a', text: '질문', intent: '', mustHit: [], redFlags: [], evidenceIds: [], answerOutline: '', followUpSeeds: [] },
      answer: long, thread: [{ q: long, a: long }, { q: long, a: long }], evidence: [1, 2, 3, 4].map((i) => ({ id: `resume#${i}`, kind: 'resume' as const, text: '나'.repeat(500) })),
      history: Array(6).fill('다'.repeat(200)), interviewers: [], followUpsUsed: 1, followUpLimit: 2,
    });
    expect(bytes(JSON.stringify(req))).toBeLessThan(LIMITS.scoreBytes);
  });
});

describe('review fix: score arriving while paused', () => {
  it('is attached and resume continues to REACT', () => {
    const plan: Plan = { interviewers: [{ id: 'a', displayName: 'A', title: '', greeting: '' }], smallTalk: { opening: [], transitions: [], acknowledgements: [] }, questions: [{ id: 'q1', stage: 'intro', askedBy: 'a', text: 't', intent: '', mustHit: [], redFlags: [], evidenceIds: [], answerOutline: '', followUpSeeds: [] }] };
    let s = initialState(plan, 'practice', [{ id: 'a', role: 'hr', rank: 'lead', gender: 'none', personality: 'warm', seed: 1 }]);
    for (const e of [{ type: 'START' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'ANSWER_SUBMIT', text: 'x' }, { type: 'PAUSE' }] as const) s = reduce(s, e);
    const score = { score: 80, grade: 'A' as const, rubric: { structure: 16, specificity: 16, jobFit: 16, consistency: 16, delivery: 16 }, strengths: [], improvements: [], flaggedPhrases: [], betterAnswer: '', followUp: null, reactions: [], summary: '' };
    s = reduce(s, { type: 'SCORE_READY', score });
    expect(s.items[0].score?.score).toBe(80);
    s = reduce(s, { type: 'RESUME' });
    expect(s.phase).toBe('REACT');
  });
});

describe('report request stays under the byte limit', () => {
  it('sends only what the report prompt uses, even for 30 answers with full guides', async () => {
    const { makeReportRequest } = await import('../src/state/requests');
    const long = '가'.repeat(300);
    const score = { score: 60, grade: 'C' as const, rubric: { structure: 12, specificity: 12, jobFit: 12, consistency: 12, delivery: 12 }, strengths: [long, long], improvements: [long, long, long], flaggedPhrases: [long], betterAnswer: long.repeat(2), followUp: null, reactions: [], summary: long,
      guide: { verdict: long, fixes: [{ point: long, how: long, example: long }], phrasing: [{ from: long, to: long }], evidence: long, drill: long } };
    const req = makeReportRequest({ sid: 's', lang: 'ko', company: '회사', role: '직무', interviewers: [], items: Array.from({ length: 30 }, (_, i) => ({ questionId: `q${i}`, stage: 'experience' as const, score })) });
    expect(bytes(JSON.stringify(req))).toBeLessThan(LIMITS.reportBytes);
    expect(req.items[0].score.score).toBe(60);
  });
});
