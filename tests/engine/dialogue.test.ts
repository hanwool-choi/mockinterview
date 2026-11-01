import { describe, it, expect } from 'vitest';
import { ackFor, chooseFollowUp, dedupeQuestions, similarity } from '../../src/engine/dialogue';
import { buildTemplatePlan } from '../../src/engine/templates';
import type { Plan } from '../../shared/schema';
import { iv, q } from './fixtures';

describe('ackFor: the reaction matches the answer', () => {
  it('never praises a weak answer and never doubts a strong one', () => {
    for (let s = 0; s < 20; s++) {
      expect(['좋네요.', '좋습니다.', '흥미롭네요.']).not.toContain(ackFor(30, 'ko', s));
      expect(ackFor(30, 'ko', s)).toMatch(/음|그렇군요|알겠습니다/);
      expect(ackFor(88, 'ko', s)).toMatch(/좋|명확|구체적/);
    }
  });
  it('speaks English for English interviews', () => {
    expect(ackFor(88, 'en', 1)).toMatch(/[a-z]/i);
  });
});

describe('chooseFollowUp: no repeated follow-ups', () => {
  it('skips a follow-up already asked and falls back to the next unused seed', () => {
    const used = new Set(['그 수치는 어떻게 측정하셨나요?']);
    expect(chooseFollowUp(['그 수치는 어떻게 측정하셨나요?', '다시 한다면 무엇을 바꾸시겠어요?'], used)).toBe('다시 한다면 무엇을 바꾸시겠어요?');
  });
  it('treats near-identical wording as a repeat', () => {
    const used = new Set(['그 수치는 어떻게 측정하셨나요?']);
    expect(chooseFollowUp(['그 수치는 어떻게 측정하신 건가요?'], used)).toBeNull();
  });
  it('returns null when everything was used', () => {
    expect(chooseFollowUp(['a b c'], new Set(['a b c']))).toBeNull();
  });
});

describe('dedupeQuestions', () => {
  it('replaces a near-duplicate question with an unused template question of the same stage', () => {
    const t = buildTemplatePlan({ lang: 'ko', company: 'C', role: 'PM', career: 'exp', interviewers: [iv('a', 'dev', 'lead')], chunks: [] });
    const p: Plan = { ...t, questions: [q('c1', 'competency', 'a', { text: '서비스 기획 직무에서 가장 자신 있는 역량을 사례로 말씀해 주세요.' }), q('c2', 'competency', 'a', { text: '서비스 기획 직무에서 가장 자신 있는 역량을 사례와 함께 말씀해 주세요.' })] };
    const out = dedupeQuestions(p, t);
    expect(out.questions).toHaveLength(2);
    expect(similarity(out.questions[0].text, out.questions[1].text)).toBeLessThan(0.6);
    expect(out.questions[1].stage).toBe('competency');
  });
  it('leaves distinct questions untouched', () => {
    const t = buildTemplatePlan({ lang: 'ko', company: 'C', role: 'PM', career: 'exp', interviewers: [iv('a', 'dev', 'lead')], chunks: [] });
    expect(dedupeQuestions(t, t).questions.map((x) => x.text)).toEqual(t.questions.map((x) => x.text));
  });
});

describe('sanitizeFollowUp', () => {
  const sc = (text: string) => ({ score: 50, grade: 'C' as const, rubric: { structure: 10, specificity: 10, jobFit: 10, consistency: 10, delivery: 10 }, strengths: [], improvements: [], flaggedPhrases: [], betterAnswer: '', reactions: [], summary: '', followUp: { needed: true, askedBy: 'a', text } });
  const question = q('q1', 'experience', 'a', { followUpSeeds: ['그 수치는 어떻게 측정하셨나요?', '다시 한다면 무엇을 바꾸시겠어요?'] });
  it('replaces a follow-up that repeats one already asked with an unused seed', async () => {
    const { sanitizeFollowUp } = await import('../../src/engine/dialogue');
    const out = sanitizeFollowUp(sc('그 수치는 어떻게 측정하셨나요?'), question, new Set(['그 수치는 어떻게 측정하셨나요?']), []);
    expect(out.followUp?.text).toBe('다시 한다면 무엇을 바꾸시겠어요?');
  });
  it('drops a follow-up that overlaps a question still to come', async () => {
    const { sanitizeFollowUp } = await import('../../src/engine/dialogue');
    const upcoming = ['동료와 의견이 크게 부딪혔던 경험과 해결 과정을 말씀해 주세요.'];
    const out = sanitizeFollowUp(sc('동료와 의견이 크게 부딪혔던 경험과 해결 과정을 말씀해 주세요.'), { ...question, followUpSeeds: [] }, new Set(), upcoming);
    expect(out.followUp).toBeNull();
  });
  it('keeps a fresh, specific follow-up as is', async () => {
    const { sanitizeFollowUp } = await import('../../src/engine/dialogue');
    const out = sanitizeFollowUp(sc('간편결제 부분환불 정책 차이는 어떻게 정리하셨나요?'), question, new Set(), []);
    expect(out.followUp?.text).toBe('간편결제 부분환불 정책 차이는 어떻게 정리하셨나요?');
  });
});
