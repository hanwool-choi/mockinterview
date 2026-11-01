import { describe, it, expect } from 'vitest';
import { inLanguage } from '../../functions/_lib/lang';

describe('inLanguage: catches broken Korean seen in the real run', () => {
  it('rejects Latin fragments glued to Hangul', () => {
    expect(inLanguage('ko', ['다수 이해relations자 사이에서 정책을 조율한 경험'])).toBe(false);
    expect(inLanguage('ko', ['NHN Link는 티cket 예매 전문 기업입니다'])).toBe(false);
  });
  it('rejects Chinese/Japanese characters in Korean text', () => {
    expect(inLanguage('ko', ['정책이 반대된 경우가 있었습니다吗?'])).toBe(false);
  });
  it('rejects stray lowercase English words that are not in the source', () => {
    expect(inLanguage('ko', ['먼저 1분 정도로 본인을 introducer 부탁드립니다.'])).toBe(false);
  });
  it('accepts acronyms, product names and words that appear in the source', () => {
    expect(inLanguage('ko', ['API 명세와 PG 연동, A/B 테스트, SQL로 결제 로그를 봤습니다.'])).toBe(true);
    expect(inLanguage('ko', ['NHN Link의 티켓링크 서비스에서 Amplitude 퍼널을 보셨나요?'], 'Amplitude 퍼널')).toBe(true);
    expect(inLanguage('ko', ['결제 flow를 어떻게 바꾸셨나요?'], '결제 flow 개선')).toBe(true);
  });
  it('still rejects an English reply to a Korean interview', () => {
    expect(inLanguage('ko', ['Provide specific metrics', 'Explain your role'])).toBe(false);
  });
  it('rejects Hangul-heavy text in an English interview', () => {
    expect(inLanguage('en', ['수치를 넣으세요', 'Explain your role', '역할을 설명하세요'])).toBe(false);
    expect(inLanguage('en', ['Explain your role in the 결제 project'])).toBe(true);
  });
});
