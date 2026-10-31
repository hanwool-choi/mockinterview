import { describe, it, expect } from 'vitest';
import { chunkDoc, budgetChunks, isLikelyScanned } from '../../src/docs/chunk';

const para = (n: number, w = '가나다라마바사. ') => w.repeat(Math.ceil(n / w.length)).slice(0, n);

describe('chunkDoc', () => {
  it('splits a long paragraph into ≤500-char chunks with sequential ids', () => {
    const cs = chunkDoc('resume', para(1200));
    expect(cs.length).toBeGreaterThanOrEqual(3);
    for (const c of cs) expect(c.text.length).toBeLessThanOrEqual(500);
    expect(cs[0].id).toBe('resume#1');
    expect(cs[1].id).toBe('resume#2');
  });
  it('merges short paragraphs up to ~300+ chars', () => {
    const cs = chunkDoc('jd', ['짧은 문단 하나', '짧은 문단 둘', '짧은 문단 셋'].join('\n\n'));
    expect(cs.length).toBe(1);
  });
  it('returns [] for empty text', () => {
    expect(chunkDoc('portfolio', '  \n ')).toEqual([]);
  });
});

describe('budgetChunks', () => {
  it('keeps total ≤ max and keeps every jd chunk', () => {
    const jd = chunkDoc('jd', para(3000));
    const resume = chunkDoc('resume', para(30000, 'MAU 성장 프로젝트. '));
    const pf = chunkDoc('portfolio', para(40000, '디자인 시안 작업. '));
    const out = budgetChunks([...jd, ...resume, ...pf], 60000, 'MAU 성장');
    const total = out.reduce((n, c) => n + c.text.length, 0);
    expect(total).toBeLessThanOrEqual(60000);
    for (const c of jd) expect(out.find((o) => o.id === c.id)).toBeTruthy();
    const ids = out.map((c) => c.id);
    const orig = [...jd, ...resume, ...pf].map((c) => c.id).filter((id) => ids.includes(id));
    expect(ids).toEqual(orig);
  });
});

describe('isLikelyScanned', () => {
  it('flags near-empty extraction', () => {
    expect(isLikelyScanned('   ')).toBe(true);
    expect(isLikelyScanned('가'.repeat(250))).toBe(false);
  });
});
