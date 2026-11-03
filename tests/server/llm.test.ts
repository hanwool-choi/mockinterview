import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseModelJson, callJson } from '../../functions/_lib/llm';
import { memKV } from './memkv';

const schema = z.object({ a: z.number() });
const models = ['m/one:free', 'm/two:free', 'm/three:free'];

function env(extra: Record<string, unknown> = {}) {
  const kv = memKV();
  kv.put('models:free:v2', JSON.stringify({ at: Date.now(), ids: models }));
  return { IV_KV: kv, OPENROUTER_API_KEY: 'test-key', ...extra } as never;
}
const chat = (content: string, status = 200) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

describe('parseModelJson', () => {
  it('extracts JSON from prose and code fences', () => {
    expect(parseModelJson('설명\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('Sure! {"a": 2} hope it helps')).toEqual({ a: 2 });
  });
  it('returns null on garbage', () => {
    expect(parseModelJson('none')).toBeNull();
  });
});

describe('callJson', () => {
  it('turns model reasoning off by default (thinking made each call 4-5x slower)', async () => {
    const bodies: Record<string, unknown>[] = [];
    const f = (async (_u: string, init: RequestInit) => (bodies.push(JSON.parse(String(init.body))), chat('{"a":1}'))) as unknown as typeof fetch;
    await callJson(env(), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(bodies[0].reasoning).toEqual({ enabled: false });
    await callJson(env({ LLM_REASONING: 'on' }), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(bodies[1].reasoning).toBeUndefined();
  });
  it('retries once without the reasoning switch when a provider rejects it', async () => {
    const bodies: Record<string, unknown>[] = [];
    const f = (async (_u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body));
      bodies.push(b);
      return b.reasoning ? new Response('{"error":{"code":400}}', { status: 400 }) : chat('{"a":7}');
    }) as unknown as typeof fetch;
    const r = await callJson(env(), { messages: [], schema, timeoutMs: 5000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r).toMatchObject({ ok: true, data: { a: 7 }, model: 'm/one:free' });
    expect(bodies.length).toBe(2);
  });

  it('moves to the next model on 429', async () => {
    const seen: string[] = [];
    const f = (async (_u: string, init: RequestInit) => {
      const m = JSON.parse(String(init.body)).model;
      seen.push(m);
      return m === 'm/one:free' ? new Response('rate', { status: 429 }) : chat('{"a":5}');
    }) as unknown as typeof fetch;
    const r = await callJson(env(), { messages: [{ role: 'user', content: 'x' }], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r).toMatchObject({ ok: true, data: { a: 5 }, model: 'm/two:free' });
    expect(seen).toEqual(['m/one:free', 'm/two:free']);
  });
  it('reports fallback after 3 failing models', async () => {
    const f = (async () => new Response('err', { status: 500 })) as unknown as typeof fetch;
    const r = await callJson(env(), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fallback).toBe(true);
      expect(r.errors.length).toBe(3);
    }
  });
  it('re-asks the same model once when schema validation fails', async () => {
    let n = 0;
    const f = (async () => (++n === 1 ? chat('{"a":"bad"}') : chat('{"a":7}'))) as unknown as typeof fetch;
    const r = await callJson(env(), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r).toMatchObject({ ok: true, data: { a: 7 }, model: 'm/one:free' });
    expect(n).toBe(2);
  });
  it('uses fake when no key and never calls fetch', async () => {
    let called = false;
    const f = (async () => { called = true; return chat('{}'); }) as unknown as typeof fetch;
    const r = await callJson({ IV_KV: memKV() } as never, { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 9 }) });
    expect(r).toMatchObject({ ok: true, data: { a: 9 }, model: 'fake' });
    expect(called).toBe(false);
  });
  it('treats timeout as failure and moves on', async () => {
    const f = ((_u: string, init: RequestInit) => {
      const m = JSON.parse(String(init.body)).model;
      if (m === 'm/one:free') return new Promise((_, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted'))));
      return Promise.resolve(chat('{"a":3}'));
    }) as unknown as typeof fetch;
    const r = await callJson(env(), { messages: [], schema, timeoutMs: 30, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r.ok && r.model).toBe('m/two:free');
  });
  it('tries the paid overflow model last when enabled', async () => {
    const f = (async (_u: string, init: RequestInit) => {
      const m = JSON.parse(String(init.body)).model;
      return m === 'paid/cheap' ? chat('{"a":1}') : new Response('', { status: 503 });
    }) as unknown as typeof fetch;
    const r = await callJson(env({ PAID_OVERFLOW: 'on', PAID_MODEL: 'paid/cheap' }), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r.ok && r.model).toBe('paid/cheap');
  });
});

describe('callJson language and health', () => {
  it('rejects an English reply when validate() requires Korean and moves on', async () => {
    const f = (async (_u: string, init: RequestInit) => {
      const m = JSON.parse(String(init.body)).model;
      return chat(m === 'm/one:free' ? '{"a":1,"t":"Provide metrics"}' : '{"a":2,"t":"수치를 제시하세요"}');
    }) as unknown as typeof fetch;
    const s = z.object({ a: z.number(), t: z.string() });
    const r = await callJson(env(), { messages: [], schema: s, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0, t: '' }), validate: (d) => /[가-힣]/.test(d.t) });
    expect(r.ok && r.model).toBe('m/two:free');
  });
  it('marks a 403 model so the next call skips it', async () => {
    const e = env();
    let calls: string[] = [];
    const f = (async (_u: string, init: RequestInit) => {
      const m = JSON.parse(String(init.body)).model;
      calls.push(m);
      return m === 'm/one:free' ? new Response('gated', { status: 403 }) : chat('{"a":1}');
    }) as unknown as typeof fetch;
    await callJson(e, { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    calls = [];
    await callJson(e, { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(calls[0]).toBe('m/two:free');
  });
});

describe('paid fallback after the free budget', () => {
  it('switches to the paid model when free models are slower than the free budget', async () => {
    const seen: string[] = [];
    const f = ((_u: string, init: RequestInit) => {
      const m = JSON.parse(String(init.body)).model;
      seen.push(m);
      if (m.startsWith('paid/')) return Promise.resolve(chat('{"a":4}'));
      return new Promise((_, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted'))));
    }) as unknown as typeof fetch;
    const t0 = Date.now();
    const r = await callJson(env({ PAID_OVERFLOW: 'on', PAID_MODEL: 'paid/a,paid/b' }), { messages: [], schema, timeoutMs: 1000, freeBudgetMs: 60, deadlineMs: 5000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r.ok && r.model).toBe('paid/a');
    expect(Date.now() - t0).toBeLessThan(800);
  });
  it('tries the next paid model when one returns 402', async () => {
    const f = (async (_u: string, init: RequestInit) => {
      const m = JSON.parse(String(init.body)).model;
      if (m === 'paid/a') return new Response('no credit', { status: 402 });
      if (m === 'paid/b') return chat('{"a":5}');
      return new Response('', { status: 503 });
    }) as unknown as typeof fetch;
    const r = await callJson(env({ PAID_OVERFLOW: 'on', PAID_MODEL: 'paid/a,paid/b' }), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r.ok && r.model).toBe('paid/b');
  });
  it('stops using paid models once the monthly cap is reached', async () => {
    const e = env({ PAID_OVERFLOW: 'on', PAID_MODEL: 'paid/a', PAID_MONTHLY_CALLS: '1' });
    const f = (async (_u: string, init: RequestInit) => {
      const m = JSON.parse(String(init.body)).model;
      return m === 'paid/a' ? chat('{"a":1}') : new Response('', { status: 503 });
    }) as unknown as typeof fetch;
    const first = await callJson(e, { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    const second = await callJson(e, { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  });
});

describe('account-wide free quota', () => {
  it('skips all free models after a free-models-per-day 429 until reset', async () => {
    const e = env({ PAID_OVERFLOW: 'on', PAID_MODEL: 'paid/a' });
    const seen: string[] = [];
    const f = (async (_u: string, init: RequestInit) => {
      const m = JSON.parse(String(init.body)).model;
      seen.push(m);
      if (m.startsWith('paid/')) return chat('{"a":1}');
      return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded: free-models-per-day', code: 429, metadata: { headers: { 'X-RateLimit-Reset': String(Date.now() + 3_600_000) } } } }), { status: 429 });
    }) as unknown as typeof fetch;
    await callJson(e, { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    seen.length = 0;
    const r = await callJson(e, { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(seen).toEqual(['paid/a']);
    expect(r.ok && r.model).toBe('paid/a');
  });
});

describe('callJson usage metering', () => {
  const withUsage = (content: string, usage: Record<string, number>) => new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), { status: 200 });
  it('asks OpenRouter for usage and returns tokens and cost, including failed attempts', async () => {
    const bodies: Record<string, unknown>[] = [];
    let n = 0;
    const f = (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      n++;
      return n === 1 ? withUsage('not json', { prompt_tokens: 100, completion_tokens: 10, cost: 0.00001 }) : withUsage('{"a":3}', { prompt_tokens: 120, completion_tokens: 20, cost: 0.00002 });
    }) as unknown as typeof fetch;
    const r = await callJson(env(), { messages: [], schema, timeoutMs: 1000, maxTokens: 300, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r.ok).toBe(true);
    expect(bodies[0].usage).toEqual({ include: true });
    expect(bodies[0].max_tokens).toBe(300);
    expect(r.usage).toEqual({ calls: 2, tokensIn: 220, tokensOut: 30, costUsd: 0.00003 });
  });
  it('reports usage on fallback too', async () => {
    const f = (async () => withUsage('nope', { prompt_tokens: 50, completion_tokens: 5, cost: 0 })) as unknown as typeof fetch;
    const r = await callJson(env(), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r.ok).toBe(false);
    expect(r.usage.calls).toBeGreaterThan(0);
    expect(r.usage.tokensIn).toBe(50 * r.usage.calls);
  });
});

describe('callJson with Google Gemini (direct API)', () => {
  const gem = (content: string, usage = { prompt_tokens: 1000, completion_tokens: 200 }) => new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), { status: 200 });
  it('calls Gemini first, through its OpenAI-compatible endpoint with the Gemini key', async () => {
    const seen: { url: string; auth: string | null; body: Record<string, unknown> }[] = [];
    const f = (async (u: string, init: RequestInit) => {
      seen.push({ url: String(u), auth: new Headers(init.headers).get('Authorization'), body: JSON.parse(String(init.body)) });
      return gem('{"a":4}');
    }) as unknown as typeof fetch;
    const r = await callJson(env({ GEMINI_API_KEY: 'g-key', GEMINI_MODELS: 'gemini-2.5-flash-lite,gemini-3.5-flash-lite' }), { messages: [], schema, timeoutMs: 1000, maxTokens: 500, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r).toMatchObject({ ok: true, data: { a: 4 }, model: 'gemini:gemini-2.5-flash-lite' });
    expect(seen[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(seen[0].auth).toBe('Bearer g-key');
    expect(seen[0].body).toMatchObject({ model: 'gemini-2.5-flash-lite', max_tokens: 500, reasoning_effort: 'none' });
  });
  it('newer Gemini models get the lowest thinking level (they cannot turn it off)', async () => {
    const bodies: Record<string, unknown>[] = [];
    const f = (async (_u: string, init: RequestInit) => (bodies.push(JSON.parse(String(init.body))), gem('{"a":1}'))) as unknown as typeof fetch;
    await callJson(env({ GEMINI_API_KEY: 'g', GEMINI_MODELS: 'gemini-3.5-flash-lite' }), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(bodies[0].reasoning_effort).toBe('low');
  });
  it('free tier records tokens at $0; paid tier prices them from GEMINI_PRICES', async () => {
    const f = (async () => gem('{"a":1}')) as unknown as typeof fetch;
    const free = await callJson(env({ GEMINI_API_KEY: 'g', GEMINI_MODELS: 'm1' }), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(free.usage).toEqual({ calls: 1, tokensIn: 1000, tokensOut: 200, costUsd: 0 });
    const paid = await callJson(env({ GEMINI_API_KEY: 'g', GEMINI_MODELS: 'm1', GEMINI_TIER: 'paid', GEMINI_PRICES: 'm1:0.3/2.5' }), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(paid.usage.costUsd).toBeCloseTo(1000 * 0.3e-6 + 200 * 2.5e-6, 10);
  });
  it('the default models are priced on the paid tier, so budgets can stop them', async () => {
    const f = (async () => gem('{"a":1}')) as unknown as typeof fetch;
    const r = await callJson(env({ GEMINI_API_KEY: 'g', GEMINI_TIER: 'paid' }), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r).toMatchObject({ ok: true, model: 'gemini:gemini-2.5-flash-lite' });
    expect(r.usage.costUsd).toBeCloseTo(1000 * 0.1e-6 + 200 * 0.4e-6, 10);
  });
  it('falls back to OpenRouter when Gemini is rate limited', async () => {
    const f = (async (u: string) => (String(u).includes('googleapis') ? new Response('quota', { status: 429 }) : chat('{"a":9}'))) as unknown as typeof fetch;
    const r = await callJson(env({ GEMINI_API_KEY: 'g', GEMINI_MODELS: 'm1' }), { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(r).toMatchObject({ ok: true, data: { a: 9 }, model: 'm/one:free' });
  });
  it('works with only a Gemini key (no OpenRouter key) and is fake only with neither', async () => {
    const f = (async () => gem('{"a":2}')) as unknown as typeof fetch;
    const only = { IV_KV: memKV(), GEMINI_API_KEY: 'g', GEMINI_MODELS: 'm1' } as never;
    expect(await callJson(only, { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) })).toMatchObject({ ok: true, data: { a: 2 } });
    expect(await callJson({ IV_KV: memKV() } as never, { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) })).toMatchObject({ model: 'fake' });
  });
});
