import type { Lang } from '../../shared/schema';

const HANGUL = /[가-힣]/g;
const CJK_OTHER = /[一-鿿぀-ヿ]/; // Han ideographs, kana
const LATIN_RUN = /[A-Za-z]+/g;
/** Work vocabulary Korean speakers really use in English (lowercase forms the model may write). */
const WORK_TERMS = new Set(['value', 'test', 'funnel', 'cohort', 'sprint', 'backlog', 'roadmap', 'figma', 'jira', 'slack', 'notion', 'excel', 'app', 'web']);

const mostlyKorean = (t: string) => {
  const h = (t.match(HANGUL) ?? []).length;
  const l = (t.match(/[A-Za-z]/g) ?? []).length;
  return h > 0 && h >= l;
};

/** A Korean string is clean when it has no stray CJK/kana and no lowercase English fragments that the source never used. */
function cleanKorean(t: string, source: string): boolean {
  if (CJK_OTHER.test(t)) return false;
  for (const m of t.matchAll(LATIN_RUN)) {
    const run = m[0];
    if (!/[a-z]/.test(run)) continue; // acronyms (API, PG, SQL, A/B) are fine
    if (WORK_TERMS.has(run.toLowerCase())) continue;
    if (/[A-Za-z]-$/.test(t.slice(Math.max(0, (m.index ?? 0) - 2), m.index))) continue; // p-value, e-mail
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
