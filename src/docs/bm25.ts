import type { Chunk, Lang } from '../../shared/schema';

const HANGUL = /[가-힣]+/g;
const LATIN = /[a-z0-9][a-z0-9+#.]*[a-z0-9+#]|[a-z0-9]{2,}/g;

/** Mixed tokenizer: latin/digit words (≥2 chars) + hangul bigrams (single syllables kept). */
export function tokenize(text: string, _lang: Lang = 'ko'): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  for (const w of t.match(LATIN) ?? []) if (w.length >= 2) out.push(w);
  for (const h of t.match(HANGUL) ?? []) {
    if (h.length === 1) out.push(h);
    for (let i = 0; i + 1 < h.length; i++) out.push(h.slice(i, i + 2));
  }
  return out;
}

export class BM25 {
  private docs: { chunk: Chunk; tf: Map<string, number>; len: number }[];
  private df = new Map<string, number>();
  private avg: number;
  constructor(chunks: Chunk[], private lang: Lang, private k1 = 1.5, private b = 0.75) {
    this.docs = chunks.map((chunk) => {
      const toks = tokenize(chunk.text, lang);
      const tf = new Map<string, number>();
      for (const k of toks) tf.set(k, (tf.get(k) ?? 0) + 1);
      for (const k of tf.keys()) this.df.set(k, (this.df.get(k) ?? 0) + 1);
      return { chunk, tf, len: toks.length };
    });
    this.avg = this.docs.reduce((n, d) => n + d.len, 0) / Math.max(1, this.docs.length);
  }
  score(query: string): { chunk: Chunk; score: number }[] {
    const q = [...new Set(tokenize(query, this.lang))];
    const N = this.docs.length;
    return this.docs.map((d) => {
      let s = 0;
      for (const k of q) {
        const f = d.tf.get(k);
        if (!f) continue;
        const df = this.df.get(k) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        s += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / (this.avg || 1)));
      }
      return { chunk: d.chunk, score: s };
    });
  }
  search(query: string, k: number): Chunk[] {
    return this.score(query)
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((r) => r.chunk);
  }
}
