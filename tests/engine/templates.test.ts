import { describe, it, expect } from 'vitest';
import { buildTemplatePlan, claimAnchor, fillMissing, quoteKo, STAGE_PLAN } from '../../src/engine/templates';
import { SAMPLE } from '../../src/samples/sample';
import { chunkDoc } from '../../src/docs/chunk';
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

describe('claim quote', () => {
  it('quotes the line with the most figures, not the header line', () => {
    const cs = [{ id: 'resume#1', kind: 'resume' as const, text: '홍길동 · 서비스 기획 5년\n[경력] 오늘장보기 (2021.03 ~ 현재)\n- 장바구니 재구매 추천 기능 기획: 재구매율 18% → 27% 개선 (A/B 실험 6주, 표본 12만 명)' }];
    const p = buildTemplatePlan({ ...input, chunks: cs });
    const q = p.questions.find((x) => x.stage === 'experience')!;
    expect(q.text).toContain('재구매율 18%');
    expect(q.text).not.toContain('홍길동');
  });
});

describe('quick interview plan', () => {
  it('has exactly three questions: introduction from the bank, then one resume and one competency question', async () => {
    const { buildTemplatePlan, QUICK_STAGES } = await import('../../src/engine/templates');
    expect(QUICK_STAGES).toEqual(['intro', 'experience', 'competency']);
    const p = buildTemplatePlan({ lang: 'ko', company: 'C', role: 'PM', career: 'exp', interviewers: [{ id: 'a', role: 'hr', rank: 'lead', gender: 'female', personality: 'warm', seed: 1 }], chunks: [{ id: 'resume#1', kind: 'resume', text: '전환율 61% → 72% 개선' }], stages: QUICK_STAGES });
    expect(p.questions.map((q) => q.stage)).toEqual(['intro', 'experience', 'competency']);
    expect(p.questions[1].text).toContain('61%');
  });
});

describe('resume questions carry their context (no bare numbers)', () => {
  const ko = { id: 'resume#1', kind: 'resume' as const, text: '가상지원자 · 서비스 기획 5년\n\n[경력] 오늘장보기 (2021.03 ~ 현재) 프로덕트 기획 매니저\n- 결제 단계 간소화로 결제 이탈률 32%에서 21%로 감소\n- 장바구니 재구매 추천 기능 기획: 재구매율 18% → 27% 개선 (A/B 실험 6주, 표본 12만 명)' };
  const pf = { id: 'portfolio#1', kind: 'portfolio' as const, text: '[포트폴리오] 정기배송 구독 서비스 0→1\n- 문제: 신선식품 재구매 주기가 불규칙해 이탈이 많음\n- 결과: 3개월 유지율 61%, 구독 고객 객단가 일반 고객 대비 1.6배' };
  const en = { id: 'resume#1', kind: 'resume' as const, text: 'FreshDaily (Mar 2021 – present) Product Manager\n- Simplified checkout, cutting drop-off from 32% to 21%' };
  const enPf = { id: 'portfolio#1', kind: 'portfolio' as const, text: 'Case study: Subscription 0→1\n- Result: 61% 3-month retention; subscriber AOV 1.6x non-subscribers' };

  it('names the company the claim comes from', () => {
    const a = claimAnchor(ko.text, 'ko');
    expect(a.claim).toBe('장바구니 재구매 추천 기능 기획: 재구매율 18% → 27% 개선');
    expect(a.where).toBe('오늘장보기에 계실 때');
    const q = buildTemplatePlan({ ...input, chunks: [ko] }).questions.find((x) => x.stage === 'experience')!;
    expect(q.text).toContain('오늘장보기에 계실 때');
    expect(q.text).toContain('재구매율 18% → 27% 개선');
    expect(q.text).not.toContain('…');
  });
  it('names the portfolio project', () => {
    expect(claimAnchor(pf.text, 'ko').where).toBe("포트폴리오의 '정기배송 구독 서비스 0→1' 프로젝트에서");
    expect(claimAnchor(enPf.text, 'en').where).toBe('In your "Subscription 0→1" case study');
  });
  it('english: company from a dated header line', () => {
    const a = claimAnchor(en.text, 'en');
    expect(a.where).toBe('At FreshDaily');
    expect(a.claim).toBe('Simplified checkout, cutting drop-off from 32% to 21%');
  });
  it('without a header it still says where it is from', () => {
    expect(claimAnchor('- 상품 등록 시간 평균 9분 → 4분 단축', 'ko').where).toBe('이력서에');
  });
  it('long claims are cut at a word boundary, never mid-word', () => {
    const long = '- ' + '대규모 물류 연동 프로젝트를 주도하며 여러 팀과 협업해 재고 정확도를 99.2%까지 끌어올리고 품절률을 4.1%에서 1.3%로 낮춘 경험'.repeat(1);
    const c = claimAnchor(long, 'ko').claim;
    expect(c.length).toBeLessThanOrEqual(80);
    expect(long).toContain(c.replace(/…$/, ''));
    expect(c.endsWith('…')).toBe(false);
  });
});

describe('claim choice and Korean grammar', () => {
  it('uses 이라고 after a final consonant and 라고 otherwise', () => {
    expect(quoteKo('재구매율 18% → 27% 개선')).toBe('"재구매율 18% → 27% 개선"이라고');
    expect(quoteKo('상품 등록 시간 9분 → 4분 단축')).toBe('"상품 등록 시간 9분 → 4분 단축"이라고');
    expect(quoteKo('객단가 1.6배')).toBe('"객단가 1.6배"라고');
    expect(quoteKo('구독자 4만 명 확보')).toBe('"구독자 4만 명 확보"라고');
    expect(quoteKo('이탈률 21%')).toBe('"이탈률 21%"라고');
    expect(quoteKo('실험 120')).toBe('"실험 120"이라고');
  });
  it('drops "결과:" style labels from the quote', () => {
    expect(claimAnchor('[포트폴리오] 구독\n- 결과: 3개월 유지율 61%', 'ko').claim).toBe('3개월 유지율 61%');
  });
  it('never treats a skills line as an achievement; spreads questions over different claims', () => {
    const s = SAMPLE.ko;
    const chunks = [...chunkDoc('jd', s.docs.jd), ...chunkDoc('resume', s.docs.resume), ...chunkDoc('portfolio', s.docs.portfolio)];
    const exp = buildTemplatePlan({ ...input, chunks }).questions.filter((x) => x.stage === 'experience').map((q) => q.text);
    expect(exp.join(' ')).not.toMatch(/SQL, GA4/);
    expect(new Set(exp.map((t) => t.split('"')[1])).size).toBe(3);
  });
});
