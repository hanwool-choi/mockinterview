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
    expect(r).toEqual({ ok: true, data: { a: 7 }, model: 'm/one:free' });
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
    expect(r).toEqual({ ok: true, data: { a: 5 }, model: 'm/two:free' });
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
    expect(r).toEqual({ ok: true, data: { a: 7 }, model: 'm/one:free' });
    expect(n).toBe(2);
  });
  it('uses fake when no key and never calls fetch', async () => {
    let called = false;
    const f = (async () => { called = true; return chat('{}'); }) as unknown as typeof fetch;
    const r = await callJson({ IV_KV: memKV() } as never, { messages: [], schema, timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 9 }) });
    expect(r).toEqual({ ok: true, data: { a: 9 }, model: 'fake' });
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
