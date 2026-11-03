/**
 * The few lines of a job posting the interviewer needs every turn: duties, requirements, preferred.
 * Sent with each turn instead of the whole posting, so a turn costs the same tokens on turn 1 and turn 11.
 */
const HEADINGS: [RegExp, string][] = [
  [/^(주요\s*업무|담당\s*업무|업무\s*내용|하는\s*일|responsibilities|what you(?:'|’)ll do|role)(?=$|\s)/i, '주요업무'],
  [/^(자격\s*요건|지원\s*자격|필수\s*요건|requirements|qualifications|what we(?:'|’)re looking for)(?=$|\s)/i, '자격요건'],
  [/^(우대\s*사항|우대\s*요건|preferred|nice to have|bonus)(?=$|\s)/i, '우대사항'],
];
const OTHER = /^(전형\s*절차|근무\s*조건|복리\s*후생|혜택|접수|기타|benefits|how to apply|process)(?=$|\s|[:：])/i;

export function jdFacts(jd: string, max = 700): string {
  const lines = jd.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  let section: string | null = null;
  for (const raw of lines) {
    const head = raw.replace(/^[\[【(]?\s*/, '').replace(/[\]】):：]+\s*$/, '');
    const hit = HEADINGS.find(([re]) => re.test(head));
    if (hit && head.length < 30) {
      section = hit[1];
      continue;
    }
    if (OTHER.test(head)) {
      section = null;
      continue;
    }
    if (!section) continue;
    const text = raw.replace(/^[-•·*▪︎◦\d.)\s]+/, '').trim();
    if (text.length > 3) out.push(`[${section}] ${text}`);
  }
  const picked = out.length ? out : lines.slice(0, 8);
  let s = '';
  for (const l of picked) {
    if (s.length + l.length + 1 > max) break;
    s += (s ? '\n' : '') + l;
  }
  return s;
}
