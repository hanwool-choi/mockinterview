import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseModelJson, callJson } from '../../functions/_lib/llm';
import { memKV } from './memkv';

const schema = z.object({ a: z.number() });
const models = ['m/one:free', 'm/two:free', 'm/three:free'];

function env(extra: Record<string, unknown> = {}) {
  const kv = memKV();
  kv.put('models:free', JSON.stringify({ at: Date.now(), ids: models }));
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
