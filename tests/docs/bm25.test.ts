import { describe, it, expect } from 'vitest';
import { BM25 } from '../../src/docs/bm25';

describe('BM25', () => {
  it('ranks korean chunk by bigram overlap', () => {
    const b = new BM25([
      { id: 'resume#1', kind: 'resume', text: 'MAU 20배 성장을 이끈 그로스 실험' },
      { id: 'resume#2', kind: 'resume', text: '카페 운영과 원가 관리' },
    ], 'ko');
    expect(b.search('MAU 성장', 1)[0].id).toBe('resume#1');
  });
  it('matches english words', () => {
    const b = new BM25([
      { id: 'a', kind: 'resume', text: 'Built the billing service' },
      { id: 'b', kind: 'resume', text: 'Migrated workloads to Kubernetes clusters' },
    ], 'en');
    expect(b.search('kubernetes', 1)[0].id).toBe('b');
  });
  it('returns empty when nothing matches', () => {
    const b = new BM25([{ id: 'a', kind: 'jd', text: 'abc' }], 'en');
    expect(b.search('zzz', 3)).toEqual([]);
  });
});
