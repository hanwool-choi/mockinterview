import type { Lang } from '../../shared/schema';

/**
 * A model-written question may cite a figure only if (a) the figure is really in the documents or answers and
 * (b) the question also says what it was about, sharing words with the line the figure comes from.
 * "18% → 27% 개선에서 기여한 부분은?" fails (b); "재구매 추천으로 재구매율을 18%에서 27%로…" passes.
 */

// Words every result line shares, so they prove nothing about context.
const GENERIC_KO = new Set(['개선', '감소', '증가', '달성', '확보', '단축', '향상', '기여', '부분', '본인', '결과', '성과', '경험', '에서', '으로', '하셨', '셨는', '했는', '는데', '었다', '습니', '니다', '였나', '나요', '인가', '가요', '이었', '말씀', '주세', '세요', '정도']);
const GENERIC_EN = new Set(['what', 'your', 'that', 'with', 'from', 'which', 'have', 'were', 'this', 'part', 'role', 'result', 'results', 'improved', 'improvement', 'increase', 'increased', 'reduced', 'about', 'there', 'they', 'into', 'over', 'going', 'tell', 'more', 'how', 'did', 'you']);

const figures = (t: string) =>
  [...t.replace(/(\d),(\d{3})/g, '$1$2').matchAll(/\d+(?:\.\d+)?(\s*%)?/g)]
    .map((m) => ({ n: m[0].replace(/\s/g, ''), pct: !!m[1], v: Number(m[0].replace(/[%\s]/g, '')) }))
    // Small counts ("첫 3개월", "2가지") are ordinary speech, not cited results.
    .filter((f) => f.pct || f.v > 12 || f.n.includes('.'));

const koBigrams = (t: string) => {
  const out = new Set<string>();
  for (const w of t.match(/[가-힣]{2,}/g) ?? []) for (let i = 0; i + 2 <= w.length; i++) out.add(w.slice(i, i + 2));
  for (const g of GENERIC_KO) out.delete(g);
  return out;
};
const enWords = (t: string) => new Set((t.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !GENERIC_EN.has(w)));

export function groundedQuestion(question: string, source: string, lang: Lang): boolean {
  const figs = figures(question);
  if (!figs.length) return true;
  const src = source.replace(/(\d),(\d{3})/g, '$1$2');
  const lines = src.split(/\n|(?<=[.!?。])\s/);
  for (const f of figs) {
    const num = f.n.replace('%', '');
    const has = (l: string) => new RegExp(`(^|[^\\d.])${num.replace('.', '\\.')}(?![\\d])`).test(l);
    const origin = lines.filter(has);
    if (!origin.length) return false; // invented figure
    const ctx = origin.join(' ');
    const shared =
      lang === 'ko'
        ? [...koBigrams(question)].filter((g) => koBigrams(ctx).has(g)).length
        : [...enWords(question)].filter((w) => enWords(ctx).has(w)).length;
    if (shared < (lang === 'ko' ? 3 : 2)) return false; // a bare number: nothing says what it was about
  }
  return true;
}

// Polite question scaffolding every question shares ("말씀해 주시겠어요", "적어 주셨는데요"): not topic words.
const FILLER_KO = new Set(['말씀', '씀하', '씀해', '주시', '시겠', '겠어', '어요', '무엇', '엇인', '엇이', '인가', '가요', '나요', '적어', '주셨', '셨는', '는데', '데요', '이번', '번엔', '여쭤', '쭤볼', '볼게', '게요', '그중', '어떻', '떻게', '어떤', '이라', '라고', '하셨', '셨나', '었나', '였나', '이었', '습니', '니다', '들었', '잘들', '얘기', '나와', '와서', '서요', '그것', '그건', '세요', '주세', '해주', '구체', '체적', '적으', '으로', '에서', '하신', '신다', '다고', '쓰셨', '설명', '명해', '방금', '셨다', '셨던', '했던', '그때', '당시']);
const FILLER_EN = new Set(['what', 'your', 'that', 'with', 'from', 'which', 'have', 'were', 'this', 'about', 'there', 'tell', 'more', 'could', 'would', 'please', 'mentioned', 'let', 'switch', 'how', 'did', 'you', 'and', 'the']);

/** How much two questions are about the same thing: shared topic pieces (two-syllable or words), 0..1. */
export function topicGrams(t: string): Set<string> {
  const out = new Set<string>();
  for (const w of t.toLowerCase().match(/[가-힣]{2,}|[a-z]{3,}/g) ?? []) {
    if (/[a-z]/.test(w)) !FILLER_EN.has(w) && out.add(w);
    else for (let i = 0; i + 2 <= w.length; i++) !FILLER_KO.has(w.slice(i, i + 2)) && out.add(w.slice(i, i + 2));
  }
  return out;
}

export function overlap(a: string, b: string): number {
  const x = topicGrams(a);
  const y = topicGrams(b);
  if (!x.size || !y.size) return 0;
  let n = 0;
  for (const g of x) if (y.has(g)) n++;
  return n / Math.min(x.size, y.size);
}
