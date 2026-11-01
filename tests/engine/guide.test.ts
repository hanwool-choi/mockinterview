import { describe, it, expect } from 'vitest';
import { localScore } from '../../src/engine/localScore';
import { ScoreSchema } from '../../shared/schema';
import { normalizeScore } from '../../shared/grade';
import { q } from './fixtures';

const question = q('q1', 'experience', 'a', { mustHit: ['본인 역할', '수치', '과정'], redFlags: ['우리 팀이'] });

describe('local guide: concrete per-answer coaching', () => {
  it('detects STAR parts in a strong answer', () => {
    const s = localScore(question, '당시 인기 공연 오픈 때 서버가 자주 다운되는 문제가 있었습니다. 제 역할은 대기열 정책을 정의하는 것이었고, 입장 순번과 매크로 차단 기준을 설계해 백엔드와 API 스펙을 협의했습니다. 그 결과 오픈 42회 동안 장애 0건, 민원은 월 400건에서 60건으로 줄었습니다.', 'ko');
    expect(s.guide?.star).toEqual({ situation: 'ok', task: 'ok', action: 'ok', result: 'ok' });
  });
  it('flags missing parts, offers phrase swaps and a drill for a weak answer', () => {
    const s = localScore(question, '음.. 그건 팀에서 같이 한 거라 제 기여를 정확히 수치로 말하기는 어렵습니다.', 'ko');
    const g = s.guide!;
    expect(g.star?.result).toBe('missing');
    expect(g.phrasing.some((p) => p.from.includes('팀에서 같이') && p.to.includes('제가'))).toBe(true);
    expect(g.phrasing.some((p) => p.from.includes('음'))).toBe(true);
    expect(g.fixes.length).toBeGreaterThanOrEqual(2);
    for (const f of g.fixes) {
      expect(f.how.length).toBeGreaterThan(10);
      expect(f.example.length).toBeGreaterThan(5);
    }
    expect(g.drill.length).toBeGreaterThan(10);
    expect(g.verdict.length).toBeGreaterThan(5);
  });
  it('points to the source passage when evidence is given', () => {
    const s = localScore(question, '결제 쪽을 했습니다.', 'ko', '간편결제 3종 연동 기획: 결제 전환율 61% → 72%');
    expect(s.guide?.evidence).toContain('61%');
  });
  it('validates and survives normalization with arrays capped at 3', () => {
    const s = localScore(question, '음 잘 모르겠습니다', 'ko');
    const big = { ...s, guide: { ...s.guide!, fixes: Array(6).fill(s.guide!.fixes[0]), phrasing: Array(6).fill({ from: 'a', to: 'b' }) } };
    const n = normalizeScore(ScoreSchema.parse(big));
    expect(n.guide?.fixes.length).toBe(3);
    expect(n.guide?.phrasing.length).toBe(3);
  });
  it('writes English coaching for English interviews', () => {
    const s = localScore({ ...question, mustHit: ['my role', 'numbers'] }, 'um we did it as a team so hard to say', 'en');
    expect(s.guide?.drill).toMatch(/[a-z]/i);
    expect(s.guide?.phrasing.some((p) => /we/i.test(p.from))).toBe(true);
  });
});

describe('guide quality fixes', () => {
  it('claimLine prefers a result line over a dated header', async () => {
    const { claimLine } = await import('../../src/engine/templates');
    expect(claimLine('스몰커머스랩 (2019.07 ~ 2021.02) 서비스 기획자\n- 판매자 어드민 개편, 상품 등록 시간 평균 9분 → 4분 단축')).toContain('9분 → 4분');
  });
  it('gives concrete advice for common intro/motivation points', () => {
    const intro = localScore(q('i', 'intro', 'a', { mustHit: ['경력', '강점', '지원 동기'] }), '안녕하세요 열심히 하겠습니다.', 'ko');
    const hows = intro.guide!.fixes.map((f) => f.how).join(' ');
    expect(hows).not.toMatch(/한 문장으로 직접 언급하세요/);
    expect(hows).toMatch(/년|도메인/);
    expect(hows).toMatch(/사례/);
  });
});
