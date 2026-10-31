import { describe, it, expect } from 'vitest';
import ko from '../src/i18n/ko.json';
import en from '../src/i18n/en.json';
import { format } from '../src/i18n';

describe('i18n', () => {
  it('ko and en have identical key sets', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ko).sort());
  });
  it('formats {vars}', () => {
    expect(format('{n}자 · {s}초', { n: 3, s: 9 })).toBe('3자 · 9초');
  });
});
