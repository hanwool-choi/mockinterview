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

describe('model selection hardening (real-run findings)', () => {
  const MM = (id: string, ctx: number, out: string[] = ['text'], inp: string[] = ['text']) =>
    ({ id, context_length: ctx, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: inp, output_modalities: out } });
  it('keeps only :free text-to-text chat models', () => {
    const out = selectFreeModels([
      MM('google/lyria-3-pro-preview', 1048576, ['text', 'audio'], ['text', 'image']),
      MM('google/lyria-3-clip-preview', 1048576, ['text', 'audio']),
      MM('nvidia/nemotron-3.5-super-vl:free', 1000000, ['text'], ['image', 'text']),
      MM('some/image-gen:free', 64000, ['image']),
      MM('a/b', 64000),
    ], []);
    expect(out).toEqual(['nvidia/nemotron-3.5-super-vl:free']);
  });
});

describe('model health', () => {
  it('skips models marked dead or cooling and keeps the rest in order', async () => {
    const { markModel, healthyModels } = await import('../../functions/_lib/models');
    const env = { IV_KV: memKV() } as never;
    await markModel(env, 'x/gated:free', 403);
    await markModel(env, 'x/busy:free', 429);
    expect(await healthyModels(env, ['x/gated:free', 'x/busy:free', 'x/ok:free'])).toEqual(['x/ok:free']);
  });
  it('falls back to the full list when every model is unhealthy', async () => {
    const { markModel, healthyModels } = await import('../../functions/_lib/models');
    const env = { IV_KV: memKV() } as never;
    await markModel(env, 'x/a:free', 429);
    expect(await healthyModels(env, ['x/a:free'])).toEqual(['x/a:free']);
  });
});
