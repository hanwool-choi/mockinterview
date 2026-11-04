import { describe, expect, it } from 'vitest';
import { htmlToText, layoutText, type PdfItem } from '../../src/docs/layout';

// A text piece as pdf.js reports it: [scaleX, skewY, skewX, scaleY, x, y], width, height (y grows upwards).
const at = (str: string, x: number, y: number, size = 10, width = str.length * size * 0.9): PdfItem => ({ str, transform: [size, 0, 0, size, x, y], width, height: size });

describe('layoutText', () => {
  it('keeps a right-aligned date on its company line instead of the top of the page', () => {
    const items = [at('2021.03 ~ 현재', 460, 700), at('김가상', 40, 760, 20), at('오늘장보기 | 매니저', 40, 700), at('- 구독자 4만 명 확보', 40, 684)];
    const t = layoutText(items, 595);
    const lines = t.split('\n').filter(Boolean);
    expect(lines[0]).toContain('김가상');
    expect(lines.find((l) => l.includes('오늘장보기'))).toContain('2021.03 ~ 현재');
  });
  it('reads a sidebar column before the main column, not line by line across both', () => {
    const items = [
      at('스킬', 30, 700, 13), at('SQL / GA4', 30, 684), at('Figma', 30, 668), at('학력', 30, 640, 13), at('가상대학교', 30, 624),
      at('경력', 220, 702, 13), at('오늘장보기 · 매니저', 220, 686), at('- 재구매율 18% → 27% 개선', 220, 671), at('- 이탈률 32%에서 21%로 감소', 220, 655), at('스몰커머스랩 · 기획자', 220, 630),
    ];
    const t = layoutText(items, 595);
    expect(t.indexOf('가상대학교')).toBeLessThan(t.indexOf('오늘장보기'));
    expect(t).not.toMatch(/SQL \/ GA4.*오늘장보기/);
  });
  it('keeps table rows together with cells separated by " | "', () => {
    const items = [at('기간', 40, 700), at('회사명', 180, 700), at('직위', 300, 700), at('2021.03 ~ 현재', 40, 682), at('오늘장보기', 180, 682), at('매니저', 300, 682)];
    const t = layoutText(items, 595);
    expect(t).toContain('기간 | 회사명 | 직위');
    expect(t).toContain('2021.03 ~ 현재 | 오늘장보기 | 매니저');
  });
  it('marks larger short lines as headings and separates sections', () => {
    const t = layoutText([at('경력', 40, 700, 15), at('오늘장보기 매니저', 40, 680), at('역량', 40, 640, 15), at('SQL, Figma', 40, 620)], 595);
    expect(t).toBe('## 경력\n오늘장보기 매니저\n\n## 역량\nSQL, Figma');
  });
  it('joins a wrapped bullet line and normalises bullet glyphs', () => {
    const t = layoutText([at('• 재구매 추천 기능 기획: 재구매율 18% → 27% 개선 (A/B 실험 6', 40, 700, 10, 515), at('주, 표본 12만 명)', 50, 686)], 595);
    expect(t).toBe('- 재구매 추천 기능 기획: 재구매율 18% → 27% 개선 (A/B 실험 6주, 표본 12만 명)');
  });
  it('puts a space between words that pdf.js reports as separate pieces', () => {
    expect(layoutText([at('Product', 40, 700, 10, 40), at('Manager', 84, 700, 10, 42)], 595)).toBe('Product Manager');
    expect(layoutText([at('기획', 40, 700, 10, 20), at('자', 60, 700, 10, 10)], 595)).toBe('기획자');
  });
});

describe('htmlToText (DOCX)', () => {
  it('keeps headings, list items and table rows', () => {
    const html = '<h1>김가상</h1><h2>경력</h2><p><strong>오늘장보기</strong> (2021.03 ~ 현재)</p><ul><li>구독자 4만 명 확보</li><li>재구매율 18% &rarr; 27%</li></ul><table><tr><td>기간</td><td>회사</td></tr><tr><td>2019</td><td>스몰커머스랩</td></tr></table>';
    expect(htmlToText(html)).toBe('## 김가상\n\n## 경력\n\n오늘장보기 (2021.03 ~ 현재)\n\n- 구독자 4만 명 확보\n- 재구매율 18% → 27%\n\n기간 | 회사\n2019 | 스몰커머스랩');
  });
});

describe('wrapped paragraphs', () => {
  it('joins a line that ran to the column edge with the next one', () => {
    const t = layoutText([at('내 역할: 대기열 정책과 화면 흐름 정의, 백엔드와 토큰 발급 API', 40, 700, 10, 515), at('스펙 협의.', 40, 686, 10, 50), at('결과: 장애 0건.', 40, 660, 10, 80)], 595);
    expect(t).toBe('내 역할: 대기열 정책과 화면 흐름 정의, 백엔드와 토큰 발급 API 스펙 협의.\n\n결과: 장애 0건.');
  });
  it('joins a Korean word broken across lines without a space', () => {
    expect(layoutText([at('정책과 인프라 비용을 함', 40, 700, 10, 515), at('께 봐야 한다.', 40, 686, 10, 60)], 595)).toBe('정책과 인프라 비용을 함께 봐야 한다.');
  });
  it('does not join short lines (a list without bullet glyphs)', () => {
    expect(layoutText([at('SQL / GA4', 40, 700, 10, 60), at('Amplitude', 40, 686, 10, 60)], 595)).toBe('SQL / GA4\nAmplitude');
  });
});
