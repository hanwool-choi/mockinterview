/**
 * Rebuilds the structure of a PDF page from where its text sits, instead of the order the file stores it in
 * (which puts right-aligned dates at the top, mixes sidebar and main columns, and scatters table rows):
 * lines by baseline, words by gaps, a sidebar or second column by an empty vertical band, sections by vertical
 * gaps, headings by font size, table cells by wide gaps (" | "), and wrapped bullet lines joined back.
 */
export type PdfItem = { str?: string; transform: number[]; width: number; height: number };
type Piece = { s: string; x: number; y: number; w: number; h: number };
type Line = { y: number; h: number; items: Piece[] };

const BULLET = /^[•●▪◦‣∙■□◆◇▶▸►✓✔*·\-–—]\s*/;
const HANGUL_END = /[가-힣\d)]$/;

/** Body text size: the size most characters are set in (headings are few characters, so they do not count much). */
function bodySize(ps: Piece[]): number {
  const w = ps.map((p) => ({ h: Math.round(p.h * 2) / 2, n: p.s.length })).sort((a, b) => a.h - b.h);
  const total = w.reduce((a, b) => a + b.n, 0);
  let acc = 0;
  for (const x of w) if ((acc += x.n) >= total / 2) return x.h;
  return 10;
}

/** Splits a page into a sidebar/left column and a main/right column when an empty vertical band runs between them. */
function columns(ps: Piece[], pageW: number): Piece[][] {
  const N = 200;
  const step = pageW / N;
  const cover = new Array(N).fill(0);
  for (const p of ps) for (let k = Math.max(0, Math.floor(p.x / step)); k <= Math.min(N - 1, Math.floor((p.x + p.w) / step)); k++) cover[k]++;
  let best: { cut: number; m: number } | null = null;
  for (let k = Math.floor(N * 0.15); k < N * 0.85; k++) {
    if (cover[k]) continue;
    let e = k;
    while (e < N * 0.85 && !cover[e]) e++;
    if (e - k >= 3) {
      const cut = ((k + e) / 2) * step;
      const L = ps.filter((p) => p.x + p.w < cut);
      const R = ps.filter((p) => p.x > cut);
      // Table rows share baselines across the gap; page columns do not.
      const shared = L.filter((a) => R.some((b) => Math.abs(a.y - b.y) < 1)).length / Math.max(1, L.length);
      if (L.length >= 3 && R.length >= 3 && shared < 0.4 && (!best || Math.min(L.length, R.length) > best.m)) best = { cut, m: Math.min(L.length, R.length) };
    }
    k = e;
  }
  return best ? [ps.filter((p) => p.x < best!.cut), ps.filter((p) => p.x >= best!.cut)] : [ps];
}

/** How far right each column's text may run: the gutter for a left column, otherwise the page's mirrored left margin. */
function bounds(cols: Piece[][], pageW: number): number[] {
  const left = Math.min(...cols.flat().map((p) => p.x));
  return cols.map((c, i) => (i < cols.length - 1 ? Math.min(...cols[i + 1].map((p) => p.x)) - 8 : pageW - left));
}

function toLines(ps: Piece[]): Line[] {
  const sorted = [...ps].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const p of sorted) {
    const l = lines.find((x) => Math.abs(x.y - p.y) < Math.min(x.h, p.h) * 0.5);
    if (l) {
      l.items.push(p);
      l.h = Math.max(l.h, p.h);
    } else lines.push({ y: p.y, h: p.h, items: [p] });
  }
  lines.sort((a, b) => b.y - a.y);
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines;
}

/** One line's text: a space for a word gap, " | " for a cell gap. Returns the raw text too (trailing spaces kept). */
function lineText(l: Line): { text: string; raw: string; cells: number } {
  let t = '';
  let end: number | null = null;
  let cells = 1;
  for (const p of l.items) {
    if (end !== null) {
      const gap = p.x - end;
      if (gap > p.h * 1.5) {
        t = t.trimEnd() + ' | ';
        cells++;
      } else if (gap > p.h * 0.15 && !/\s$/.test(t)) t += ' ';
    }
    t += p.s;
    end = p.x + p.w;
  }
  return { text: t.replace(BULLET, '- ').trim(), raw: t, cells };
}

/** How wide the first word of a line is: if it would have fitted on the line above, that line was not wrapped. */
function firstWordWidth(l: Line): number {
  const p = l.items[0];
  const word = p.s.trimStart().split(/\s/)[0] ?? '';
  return p.s.length ? (p.w * word.length) / p.s.length : 0;
}

export function layoutText(items: PdfItem[], pageW: number): string {
  const ps: Piece[] = items
    .filter((i) => i.str && i.str.trim())
    .map((i) => ({ s: i.str!, x: i.transform[4], y: i.transform[5], w: i.width, h: Math.hypot(i.transform[2], i.transform[3]) || i.height || 10 }));
  if (!ps.length) return '';
  const body = bodySize(ps);
  const out: string[] = [];
  const cols = columns(ps, pageW);
  const limits = bounds(cols, pageW);
  for (const [ci, col] of cols.entries()) {
    let prev: (Line & { raw: string; right: number }) | null = null;
    const lines = toLines(col);
    // A line was wrapped by the layout when the next line's first word would not have fitted after it.
    const edge = limits[ci] - body;
    for (const l of lines) {
      const right = l.items[l.items.length - 1].x + l.items[l.items.length - 1].w;
      const { text, raw, cells } = lineText(l);
      const gap = prev ? prev.y - l.y : 0;
      const last = out.length - 1;
      const heading = l.h > body * 1.15 && text.length <= 40 && cells === 1 && !text.startsWith('- ');
      if (prev && gap > Math.max(prev.h, l.h) * 1.9 && out[last] !== '') out.push('');
      if (heading) {
        if (out.length && out[out.length - 1] !== '') out.push('');
        out.push(`## ${text}`);
      } else if (
        prev && out[last] && !out[last].startsWith('## ') && !text.startsWith('- ') && cells === 1 && !out[last].includes(' | ') && gap < l.h * 1.9 && Math.abs(prev.h - l.h) < 0.5 &&
        // a wrapped bullet (indented under its glyph) or a line that ran to the column edge
        ((out[last].startsWith('- ') && l.items[0].x > prev.items[0].x + 2) || prev.right + firstWordWidth(l) + l.h * 0.3 > edge)
      ) {
        // Korean breaks mid-word, so glue without a space only when the line ran right up to the bound (a word cut
        // in two); a line that merely came close may have ended there, so it keeps a space.
        const cut = prev.right > limits[ci] - body * 0.6;
        const glue = /\s$/.test(prev.raw) || !cut || !(HANGUL_END.test(out[last]) && /^[가-힣\d]/.test(text)) ? ' ' : '';
        out[last] = (out[last] + glue + text).replace(/\s{2,}/g, ' ');
      } else out.push(text);
      prev = { ...l, raw, right };
    }
    if (out.length && out[out.length - 1] !== '') out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rarr: '→', larr: '←', middot: '·', bull: '•', ndash: '–', mdash: '—', hellip: '…' };
const decode = (s: string) =>
  s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m)));
const inline = (h: string) => decode(h.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** DOCX (via mammoth's HTML): headings as "## ", list items as "- ", table rows as cells joined by " | ". */
export function htmlToText(html: string): string {
  const blocks: string[] = [];
  const re = /<table\b[\s\S]*?<\/table>|<(ul|ol)\b[^>]*>[\s\S]*?<\/\1>|<(h[1-6]|p)\b[^>]*>[\s\S]*?<\/\2>/gi;
  for (const m of html.matchAll(re)) {
    const b = m[0];
    if (/^<table/i.test(b)) {
      const rows = [...b.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => [...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => inline(c[1])).filter(Boolean).join(' | ')).filter(Boolean);
      if (rows.length) blocks.push(rows.join('\n'));
    } else if (m[1]) {
      const items = [...b.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => `- ${inline(li[1])}`).filter((x) => x.length > 2);
      if (items.length) blocks.push(items.join('\n'));
    } else {
      const t = inline(b);
      if (t) blocks.push(/^<h/i.test(b) ? `## ${t}` : t);
    }
  }
  return blocks.join('\n\n');
}
