import { describe, it, expect } from 'vitest';
import { followUpsLeft, initialState, MAX_FOLLOWUPS_TOTAL, reduce, type InterviewState } from '../../src/engine/machine';
import type { Plan, Score } from '../../shared/schema';
import { iv, q } from './fixtures';

const plan: Plan = {
  interviewers: [{ id: 'a', displayName: 'A', title: '', greeting: '' }],
  smallTalk: { opening: [], transitions: [], acknowledgements: [] },
  questions: [q('q1', 'intro'), q('q2', 'reverse'), q('q3', 'closing')],
};
const sc = (score: number, followUp = false): Score => ({
  score, grade: 'B', rubric: { structure: 10, specificity: 10, jobFit: 10, consistency: 10, delivery: 10 },
  strengths: [], improvements: [], flaggedPhrases: [], betterAnswer: '', reactions: [], summary: 's',
  followUp: followUp ? { needed: true, askedBy: 'a', text: '꼬리질문' } : null,
});
const run = (s: InterviewState, ...evs: Parameters<typeof reduce>[1][]) => evs.reduce(reduce, s);
const toAnswering = (mode: 'practice' | 'real', p: 'warm' | 'strict' | 'pressure' = 'warm') =>
  run(initialState(plan, mode, [iv('a', 'dev', 'lead', p)]), { type: 'START' }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' });

describe('machine', () => {
  it('walks LOBBY→GREETING→ICEBREAK→ASK→ANSWERING', () => {
    let s = initialState(plan, 'practice', [iv('a', 'dev', 'lead')]);
    expect(s.phase).toBe('LOBBY');
    s = run(s, { type: 'START' });
    expect(s.phase).toBe('GREETING');
    s = run(s, { type: 'NEXT' });
    expect(s.phase).toBe('ICEBREAK');
    s = run(s, { type: 'NEXT' });
    expect(s.phase).toBe('ASK');
    s = run(s, { type: 'NEXT' });
    expect(s.phase).toBe('ANSWERING');
  });
  it('practice: weak answer → REACT → FEEDBACK → follow-up ASK on same question', () => {
    let s = run(toAnswering('practice'), { type: 'ANSWER_SUBMIT', text: '음' });
    expect(s.phase).toBe('SCORING');
    s = run(s, { type: 'SCORE_READY', score: sc(50, true) });
    expect(s.phase).toBe('REACT');
    expect(s.items[0].score?.score).toBe(50);
    s = run(s, { type: 'NEXT' });
    expect(s.phase).toBe('FEEDBACK');
    s = run(s, { type: 'NEXT' });
    expect(s.phase).toBe('ASK');
    expect(s.qIndex).toBe(0);
    expect(s.pendingFollowUp?.text).toBe('꼬리질문');
    expect(s.followUpsUsed).toBe(1);
  });
  it('non-pressure interviewer gets no second follow-up', () => {
    let s = run(toAnswering('practice'), { type: 'ANSWER_SUBMIT', text: '음' }, { type: 'SCORE_READY', score: sc(50, true) }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' });
    expect(s.phase).toBe('ANSWERING');
    s = run(s, { type: 'ANSWER_SUBMIT', text: '음2' }, { type: 'SCORE_READY', score: sc(50, true) }, { type: 'NEXT' }, { type: 'NEXT' });
    expect(s.phase).toBe('TRANSITION');
    expect(s.items).toHaveLength(2);
    expect(s.items[1].followUp).toBe(true);
  });
  it('pressure interviewer may ask two follow-ups', () => {
    let s = run(toAnswering('real', 'pressure'), { type: 'ANSWER_SUBMIT', text: 'x' }, { type: 'SCORE_READY', score: sc(40, true) }, { type: 'NEXT' });
    expect(s.phase).toBe('ASK');
    s = run(s, { type: 'NEXT' }, { type: 'ANSWER_SUBMIT', text: 'y' }, { type: 'SCORE_READY', score: sc(40, true) }, { type: 'NEXT' });
    expect(s.phase).toBe('ASK');
    expect(s.followUpsUsed).toBe(2);
  });
  it('stops follow-ups once the interview-wide budget is spent', () => {
    // Six follow-ups already happened earlier in the interview.
    const base = toAnswering('real', 'pressure');
    const earlier = Array.from({ length: MAX_FOLLOWUPS_TOTAL }, (_, i) => ({ questionId: `x${i}`, stage: 'intro' as const, asked: '?', askedBy: 'a', answer: '.', followUp: true }));
    const s = run({ ...base, items: earlier }, { type: 'ANSWER_SUBMIT', text: 'x' }, { type: 'SCORE_READY', score: sc(40, true) }, { type: 'NEXT' });
    expect(s.phase).toBe('TRANSITION');
    expect(followUpsLeft(s)).toBe(0);
  });
  it('real mode never enters FEEDBACK', () => {
    const s = run(toAnswering('real'), { type: 'ANSWER_SUBMIT', text: 'good' }, { type: 'SCORE_READY', score: sc(80) }, { type: 'NEXT' });
    expect(s.phase).toBe('TRANSITION');
  });
  it('reverse stage uses REVERSE_QA, last question leads to CLOSING then REPORT', () => {
    let s = run(toAnswering('real'), { type: 'SKIP' });
    expect(s.phase).toBe('TRANSITION');
    expect(s.items[0].skipped).toBe(true);
    s = run(s, { type: 'NEXT' }, { type: 'NEXT' });
    expect(s.phase).toBe('REVERSE_QA');
    s = run(s, { type: 'ANSWER_SUBMIT', text: '복지는?' }, { type: 'SCORE_FAILED', score: sc(60) }, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'NEXT' });
    expect(s.phase).toBe('ANSWERING');
    s = run(s, { type: 'SKIP' }, { type: 'NEXT' });
    expect(s.phase).toBe('CLOSING');
    s = run(s, { type: 'NEXT' });
    expect(s.phase).toBe('REPORT');
  });
  it('SCORE_LATE fills a previous item without moving phase', () => {
    let s = run(toAnswering('real'), { type: 'ANSWER_SUBMIT', text: 'a' }, { type: 'SCORE_FAILED', score: { ...sc(40), local: true } });
    s = run(s, { type: 'NEXT' }, { type: 'SCORE_LATE', itemIndex: 0, score: sc(77) });
    expect(s.items[0].score?.score).toBe(77);
    expect(s.phase).toBe('TRANSITION');
  });
  it('RETRY once in practice replaces the last answer', () => {
    let s = run(toAnswering('practice'), { type: 'ANSWER_SUBMIT', text: 'a' }, { type: 'SCORE_READY', score: sc(80) }, { type: 'NEXT' });
    s = run(s, { type: 'RETRY' });
    expect(s.phase).toBe('ANSWERING');
    expect(s.items).toHaveLength(0);
    s = run(s, { type: 'ANSWER_SUBMIT', text: 'b' }, { type: 'SCORE_READY', score: sc(80) }, { type: 'NEXT' }, { type: 'RETRY' });
    expect(s.phase).toBe('FEEDBACK');
  });
  it('PAUSE/RESUME returns to previous phase; END_EARLY goes to REPORT', () => {
    let s = run(toAnswering('practice'), { type: 'PAUSE' });
    expect(s.phase).toBe('PAUSED');
    s = run(s, { type: 'RESUME' });
    expect(s.phase).toBe('ANSWERING');
    expect(run(s, { type: 'END_EARLY' }).phase).toBe('REPORT');
  });
  it('ignores events that do not apply to the current phase', () => {
    const s = toAnswering('practice');
    expect(reduce(s, { type: 'SCORE_READY', score: sc(10) })).toBe(s);
  });
});

describe('LOAD', () => {
  it('replaces the whole state (used when the real plan arrives)', () => {
    const s0 = initialState(plan, 'practice', [iv('a', 'dev', 'lead')]);
    const loaded = { ...initialState({ ...plan, questions: [q('z1', 'intro')] }, 'real', [iv('a', 'dev', 'lead')]), phase: 'GREETING' as const };
    const s1 = reduce(s0, { type: 'LOAD', state: loaded });
    expect(s1).toBe(loaded);
  });
});

describe('machine: next question rewritten by the turn call', () => {
  it('replaces a not-yet-asked question, never the current or an earlier one', () => {
    let s = toAnswering('practice');
    s = run(s, { type: 'REWRITE', index: 1, text: '새로 쓴 질문입니다?', intent: '새 의도' });
    expect(s.plan.questions[1].text).toBe('새로 쓴 질문입니다?');
    expect(s.plan.questions[1].intent).toBe('새 의도');
    const before = s.plan.questions[0].text;
    s = run(s, { type: 'REWRITE', index: 0, text: '바꾸면 안 됨', intent: '' });
    expect(s.plan.questions[0].text).toBe(before);
  });
});
