import type { Lang } from '../../shared/schema';

const HANGUL = /[가-힣]/g;
const CJK_OTHER = /[一-鿿぀-ヿ]/; // Han ideographs, kana
const LATIN_RUN = /[A-Za-z]+/g;

const mostlyKorean = (t: string) => {
  const h = (t.match(HANGUL) ?? []).length;
  const l = (t.match(/[A-Za-z]/g) ?? []).length;
  return h > 0 && h >= l;
};

/** A Korean string is clean when it has no stray CJK/kana and no lowercase English fragments that the source never used. */
function cleanKorean(t: string, source: string): boolean {
  if (CJK_OTHER.test(t)) return false;
  for (const run of t.match(LATIN_RUN) ?? []) {
    if (!/[a-z]/.test(run)) continue; // acronyms (API, PG, SQL, A/B) are fine
    if (/^[A-Z]/.test(run)) continue; // capitalised: product and company names (Link, Amplitude)
    if (run.length < 3) continue;
    if (!source.includes(run.toLowerCase())) return false; // "introducer", "relations", "cket"
  }
  return true;
}

/**
 * True when the visible strings are in the interview language.
 * Korean: at least 80% of strings mostly Hangul, and none broken by stray foreign fragments.
 * English: at most 20% of strings mostly Hangul.
 */
export function inLanguage(lang: Lang, texts: (string | undefined)[], source = ''): boolean {
  const xs = texts.filter((t): t is string => !!t && t.trim().length > 0);
  if (!xs.length) return true;
  const ko = xs.filter(mostlyKorean).length;
  if (lang === 'en') return ko / xs.length <= 0.2;
  const src = source.toLowerCase();
  return ko / xs.length >= 0.8 && xs.every((t) => cleanKorean(t, src.length ? src + ' ' + source : ''));
}
