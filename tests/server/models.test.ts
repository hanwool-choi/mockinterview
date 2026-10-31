import { describe, it, expect } from 'vitest';
import { selectFreeModels, getFreeModels } from '../../functions/_lib/models';
import { memKV } from './memkv';

const M = (id: string, p: string, c: string, ctx: number) => ({ id, context_length: ctx, pricing: { prompt: p, completion: c } });

describe('selectFreeModels', () => {
  it('keeps only zero-priced ≥32k models, preferred first, then by context desc', () => {
    const out = selectFreeModels([
      M('paid/gpt', '0.001', '0.002', 128000),
      M('small/tiny:free', '0', '0', 16000),
      M('a/qwen:free', '0', '0', 131072),
      M('b/llama-3.3:free', '0', '0', 65536),
      M('c/huge:free', '0', '0', 1000000),
    ], ['llama']);
    expect(out).toEqual(['b/llama-3.3:free', 'c/huge:free', 'a/qwen:free']);
  });
});

describe('getFreeModels', () => {
  it('caches to KV and falls back to built-in list on fetch failure', async () => {
    const kv = memKV();
    const failing = (async () => { throw new Error('net'); }) as unknown as typeof fetch;
    const out = await getFreeModels({ IV_KV: kv } as never, failing);
    expect(out.length).toBeGreaterThan(0);
    const ok = (async () => new Response(JSON.stringify({ data: [M('x/y:free', '0', '0', 64000)] }))) as unknown as typeof fetch;
    const kv2 = memKV();
    expect(await getFreeModels({ IV_KV: kv2 } as never, ok)).toEqual(['x/y:free']);
    expect(await getFreeModels({ IV_KV: kv2 } as never, failing)).toEqual(['x/y:free']);
  });
});
