import { describe, it, expect } from 'vitest';
import { mergePlanParts } from '../../functions/_lib/planParts';
import type { PlanRequest } from '../../shared/api';

const req: PlanRequest = { sid: 's', lang: 'ko', company: 'NHN Link', role: '서비스기획', career: 'exp', years: 8,
  interviewers: [{ id: 'iv1', role: 'other', rank: 'lead', gender: 'male', personality: 'strict', seed: 1 }, { id: 'iv2', role: 'hr', rank: 'manager', gender: 'female', personality: 'warm', seed: 2 }],
  chunks: [{ id: 'resume#1', kind: 'resume', text: '대기열' }] };
const Q = (id: string, stage: import('../../shared/schema').Stage) => ({ id, stage, askedBy: 'iv1', text: `${stage} 질문 ${id}`, intent: 'i', mustHit: [], redFlags: [], evidenceIds: [], answerOutline: '', followUpSeeds: [] });

describe('mergePlanParts', () => {
  it('orders stages as a real interview and gives unique ids', () => {
    const frame = { interviewers: [{ id: 'iv1', displayName: '김도윤', title: '팀장', greeting: '안녕하세요' }], smallTalk: { opening: ['오시는 길 괜찮으셨어요?'], transitions: [], acknowledgements: [] },
      questions: (['closing', 'intro', 'reverse', 'company', 'motivation', 'situational'] as const).map((s, i) => Q(`f${i}`, s)) };
    const exp = { questions: [Q('e1', 'experience'), Q('e2', 'experience'), Q('e3', 'experience')] };
    const comp = { questions: [Q('c1', 'competency'), Q('c2', 'competency')] };
    const p = mergePlanParts(req, frame, exp, comp)!;
    expect(p.questions.map((q) => q.stage)).toEqual(['intro', 'motivation', 'experience', 'experience', 'experience', 'competency', 'competency', 'company', 'situational', 'reverse', 'closing']);
    expect(new Set(p.questions.map((q) => q.id)).size).toBe(11);
    expect(p.interviewers[0].displayName).toBe('김도윤');
  });
  it('still returns a plan when the frame part failed, with default interviewer names', () => {
    const p = mergePlanParts(req, null, { questions: [Q('e1', 'experience')] }, null)!;
    expect(p.interviewers.map((i) => i.id)).toEqual(['iv1', 'iv2']);
    expect(p.questions.map((q) => q.stage)).toEqual(['experience']);
  });
  it('returns null when every part failed', () => {
    expect(mergePlanParts(req, null, null, null)).toBeNull();
  });
  it('drops questions whose stage does not belong to the part', () => {
    const p = mergePlanParts(req, null, { questions: [Q('e1', 'experience'), Q('x', 'intro')] }, null)!;
    expect(p.questions.map((q) => q.id)).toEqual(['e1']);
  });
});
