import { describe, it, expect } from 'vitest';
import { averageRubric, toMarkdown } from '../../src/report/export';
import type { Report, Score } from '../../shared/schema';
import type { AnswerItem } from '../../src/engine/machine';

const sc = (r: number, score = r * 5): Score => ({ score, grade: 'B', rubric: { structure: r, specificity: r, jobFit: r, consistency: r, delivery: r }, strengths: ['s'], improvements: ['i'], flaggedPhrases: [], betterAnswer: '더 나은 답변', followUp: null, reactions: [], summary: '' });
const items: AnswerItem[] = [
  { questionId: 'q1', stage: 'intro', asked: '자기소개 해주세요', askedBy: 'a', answer: '안녕하세요', score: sc(10), followUp: false },
  { questionId: 'q2', stage: 'experience', asked: '기여도는?', askedBy: 'a', answer: '', skipped: true, followUp: false },
  { questionId: 'q2', stage: 'experience', asked: '수치는?', askedBy: 'a', answer: '30%', score: sc(16), followUp: true },
];
const report: Report = {
  publicSummary: { company: '그린마켓', role: 'PM', grade: 'B', score: 65, verdict: 'hold', oneLiner: '한줄평' },
  privateDetail: { verdictReason: '이유', interviewerComments: [{ interviewerId: 'a', comment: '코멘트' }], top3Strengths: ['강점'], top3Fixes: ['고칠점'], nextQuestions: ['다음 질문'] },
};

describe('averageRubric', () => {
  it('averages scored, non-skipped items', () => {
    expect(averageRubric(items)).toEqual({ structure: 13, specificity: 13, jobFit: 13, consistency: 13, delivery: 13 });
  });
  it('returns zeros for no items', () => {
    expect(averageRubric([]).structure).toBe(0);
  });
});

describe('toMarkdown', () => {
  it('includes company, grade, verdict and every asked question', () => {
    const md = toMarkdown(report, items, { a: '김도윤' }, 'ko');
    expect(md).toContain('그린마켓');
    expect(md).toContain('B');
    expect(md).toContain('보류');
    for (const i of items) expect(md).toContain(i.asked);
    expect(md).toContain('김도윤');
    expect(md).toContain('더 나은 답변');
  });
});

describe('toMarkdown with guide', () => {
  it('includes verdict, fixes with examples, phrase swaps and the drill', () => {
    const g = { verdict: '역할이 빠져 회피로 들립니다.', star: { situation: 'ok' as const, task: 'missing' as const, action: 'ok' as const, result: 'weak' as const }, fixes: [{ point: '내 역할', how: '내 몫을 나누세요', example: '제가 맡은 건 정책 정의였습니다.' }], phrasing: [{ from: '팀에서 같이', to: '제가 맡은 부분은' }], evidence: '이력서의 "결제 전환율 61% → 72%"', drill: '30초 버전 말하기' };
    const md = toMarkdown(report, [{ ...items[0], score: { ...items[0].score!, guide: g } }], { a: '김도윤' }, 'ko');
    for (const s of ['역할이 빠져 회피로 들립니다.', '제가 맡은 건 정책 정의였습니다.', '팀에서 같이', '30초 버전 말하기', '결과: 약함']) expect(md).toContain(s);
  });
});
