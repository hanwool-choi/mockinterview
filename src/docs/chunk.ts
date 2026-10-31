import type { Chunk, DocKind } from '../../shared/schema';
import { BM25 } from './bm25';

const MIN = 300;
const MAX = 500;

function splitLong(p: string): string[] {
  if (p.length <= MAX) return [p];
  const sentences = p.match(/[^.!?。\n]+[.!?。]?\s*/g) ?? [p];
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if (s.length > MAX) {
      if (cur) out.push(cur.trim()), (cur = '');
      for (let i = 0; i < s.length; i += MAX) out.push(s.slice(i, i + MAX).trim());
      continue;
    }
    if ((cur + s).length > MAX) out.push(cur.trim()), (cur = '');
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

export function chunkDoc(kind: DocKind, text: string): Chunk[] {
  const paras = text.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const pieces = paras.flatMap(splitLong);
  const merged: string[] = [];
  let cur = '';
  for (const p of pieces) {
    if (!cur) cur = p;
    else if (cur.length < MIN && (cur + '\n' + p).length <= MAX) cur += '\n' + p;
    else merged.push(cur), (cur = p);
  }
  if (cur) merged.push(cur);
  return merged.map((t, i) => ({ id: `${kind}#${i + 1}`, kind, text: t }));
}

export function isLikelyScanned(text: string): boolean {
  return text.replace(/\s/g, '').length < 200;
}

const enc = new TextEncoder();
const size = (c: Chunk) => enc.encode(c.text).length;
const totalBytes = (cs: Chunk[]) => cs.reduce((n, c) => n + size(c), 0);

/** Trim to a UTF-8 byte budget: drop lowest-ranked portfolio, then resume chunks, then trailing JD chunks. */
export function budgetChunks(chunks: Chunk[], maxBytes: number, query: string): Chunk[] {
  if (totalBytes(chunks) <= maxBytes) return chunks;
  const bm = new BM25(chunks, 'ko');
  const scores = new Map(bm.score(query).map((r) => [r.chunk.id, r.score]));
  const keep = new Set(chunks.map((c) => c.id));
  let total = totalBytes(chunks);
  for (const kind of ['portfolio', 'resume', 'jd'] as DocKind[]) {
    const pool = chunks.filter((c) => c.kind === kind);
    const victims = kind === 'jd' ? pool.slice(1).reverse() : pool.sort((a, b) => (scores.get(a.id) ?? 0) - (scores.get(b.id) ?? 0));
    for (const v of victims) {
      if (total <= maxBytes) break;
      keep.delete(v.id);
      total -= size(v);
    }
  }
  return chunks.filter((c) => keep.has(c.id));
}
