/**
 * Did a restructured document keep the original's facts? It may reorder, rejoin wrapped lines and add section
 * labels ([경력], [Experience]...), but every figure must come from the original and nearly all of the original's
 * words must still be there. Anything else is a rewrite, and the original (layout) text is used instead.
 */
const LABELS = /\[(?:경력|경력사항|프로젝트|학력|역량|기술|자격|자격증|수상|기본정보|자기소개|활동|교육|기타|Experience|Projects?|Education|Skills|Certifications?|Awards|Profile|Summary|Other)\]/gi;

const figures = (t: string) => new Set((t.replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/g) ?? []));
// Table header words disappear legitimately when rows become entries ("기간 | 회사명 | 직위" → "[경력] 회사 (기간) 직위").
const HEADERS = new Set(['기간', '회사명', '회사', '직위', '직급', '직책', '담당업무', '담당', '업무', '성과', '내용', '소속', '부서', '구분', '항목', '비고', '근무기간', '재직기간', '주요', '경력사항', '학력사항', 'period', 'company', 'title', 'role', 'position', 'duties', 'responsibilities', 'achievements', 'dates']);
const words = (t: string) => (t.toLowerCase().match(/[가-힣]{2,}|[a-z]{3,}|\d+(?:\.\d+)?/g) ?? []).filter((w) => !HEADERS.has(w.replace(/(은|는|이|가|및)$/, '')));

export function preserved(original: string, restructured: string): { ok: boolean; why?: string } {
  const out = restructured.replace(LABELS, ' ');
  const src = figures(original);
  for (const f of figures(out)) if (!src.has(f)) return { ok: false, why: `figure ${f} not in original` };
  const ow = words(original);
  if (!ow.length) return { ok: false, why: 'empty' };
  const flat = out.toLowerCase().replace(/\s+/g, '');
  // Words are checked without spaces, so rejoining "함\n께" into "함께" still counts as kept.
  const kept = ow.filter((w) => flat.includes(w)).length / ow.length;
  if (kept < 0.92) return { ok: false, why: `kept ${Math.round(kept * 100)}% of the words` };
  // New words the original never had: invented sentences, not a rearrangement.
  const srcFlat = original.toLowerCase().replace(/\s+/g, '');
  const nw = words(out);
  const novel = nw.filter((w) => !srcFlat.includes(w)).length / Math.max(1, nw.length);
  if (novel > 0.1 || out.replace(/\s/g, '').length > original.replace(/\s/g, '').length * 1.25 + 80) return { ok: false, why: 'added text' };
  return { ok: true };
}
