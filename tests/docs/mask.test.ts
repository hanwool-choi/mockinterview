import { describe, it, expect } from 'vitest';
import { maskPII } from '../../src/docs/mask';

describe('maskPII', () => {
  it('masks korean phone and email', () => {
    const r = maskPII('연락처 010-1234-5678, a.b@c.com', { lang: 'ko' });
    expect(r.text).not.toMatch(/\d{4}/);
    expect(r.text).not.toContain('@');
    expect(r.text).toContain('[전화번호]');
    expect(r.hits).toBe(2);
  });
  it('masks international phone format', () => {
    expect(maskPII('Tel +82 10 1234 5678', { lang: 'en' }).text).toContain('[phone]');
  });
  it('masks resident registration number and given name', () => {
    const r = maskPII('홍길동 900101-1234567', { lang: 'ko', name: '홍길동' });
    expect(r.text).toBe('[이름] [주민번호]');
  });
  it('masks road address', () => {
    expect(maskPII('주소: 서울시 강남구 테헤란로 123', { lang: 'ko' }).text).toContain('[주소]');
  });
  it('keeps ordinary numbers like years and metrics', () => {
    expect(maskPII('2024년 MAU 20배 성장, 매출 30%', { lang: 'ko' }).text).toBe('2024년 MAU 20배 성장, 매출 30%');
  });
});
