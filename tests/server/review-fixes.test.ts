import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { reserveSlot } from '../../functions/_lib/security';
import { handleSession } from '../../functions/api/session';
import { handleScore } from '../../functions/api/score';
import { callJson } from '../../functions/_lib/llm';
import { createSession } from '../../functions/_lib/security';
import { memKV } from './memkv';

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://app.example${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('review fix: per-IP daily cap', () => {
  it('blocks a client that drops its device token after the IP cap', async () => {
    const env = { IV_KV: memKV(), DAILY_IP_INTERVIEWS: '2' } as never;
    expect((await reserveSlot(env, 'd1', '2026-10-31', 'ip-hash')).ok).toBe(true);
    expect((await reserveSlot(env, 'd2', '2026-10-31', 'ip-hash')).ok).toBe(true);
    expect(await reserveSlot(env, 'd3', '2026-10-31', 'ip-hash')).toEqual({ ok: false, reason: 'device' });
  });
  it('session endpoint applies the IP cap to token-less requests', async () => {
    const env = { IV_KV: memKV(), DEVICE_SECRET: 's', DAILY_IP_INTERVIEWS: '1' } as never;
    const h = { 'CF-Connecting-IP': '1.2.3.4' };
    expect((await handleSession(post('/api/session', {}, h), env)).status).toBe(200);
    expect((await handleSession(post('/api/session', {}, h), env)).status).toBe(429);
  });
});

describe('review fix: fail closed in production', () => {
  it('refuses sessions when a real key is set but DEVICE_SECRET or TURNSTILE_SECRET is missing', async () => {
    const env = { IV_KV: memKV(), OPENROUTER_API_KEY: 'k', TURNSTILE_SECRET: 't' } as never;
    expect((await handleSession(post('/api/session', {}), env)).status).toBe(503);
    const env2 = { IV_KV: memKV(), OPENROUTER_API_KEY: 'k', DEVICE_SECRET: 'd' } as never;
    expect((await handleSession(post('/api/session', {}), env2)).status).toBe(503);
  });
});

describe('review fix: overall deadline', () => {
  it('gives up before the deadline even when every model hangs', async () => {
    const kv = memKV();
    await kv.put('models:free', JSON.stringify({ at: Date.now(), ids: ['a', 'b', 'c'] }));
    const hang = ((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch;
    const t0 = Date.now();
    const r = await callJson({ IV_KV: kv, OPENROUTER_API_KEY: 'k' } as never, { messages: [], schema: z.object({ a: z.number() }), timeoutMs: 80, deadlineMs: 120, fetchFn: hang, fake: () => ({ a: 0 }) });
    expect(r.ok).toBe(false);
    expect(Date.now() - t0).toBeLessThan(200);
  });
  it('tries the paid overflow model only once', async () => {
    const kv = memKV();
    await kv.put('models:free', JSON.stringify({ at: Date.now(), ids: ['a'] }));
    const seen: string[] = [];
    const f = (async (_u: string, init: RequestInit) => {
      seen.push(JSON.parse(String(init.body)).model);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }));
    }) as unknown as typeof fetch;
    await callJson({ IV_KV: kv, OPENROUTER_API_KEY: 'k', PAID_OVERFLOW: 'on', PAID_MODEL: 'paid' } as never, { messages: [], schema: z.object({ a: z.number() }), timeoutMs: 1000, fetchFn: f, fake: () => ({ a: 0 }) });
    expect(seen.filter((m) => m === 'paid')).toHaveLength(1);
  });
});

describe('review fix: followUp.askedBy validated', () => {
  it('blanks an unknown askedBy returned by the model', async () => {
    const kv = memKV();
    await kv.put('models:free', JSON.stringify({ at: Date.now(), ids: ['m'] }));
    const env = { IV_KV: kv, OPENROUTER_API_KEY: 'k', DEVICE_SECRET: 's', TURNSTILE_SECRET: 't' } as never;
    const sid = await createSession(env, 'dev');
    const out = { rubric: { structure: 10, specificity: 10, jobFit: 10, consistency: 10, delivery: 10 }, score: 50, followUp: { needed: true, askedBy: '김민수', text: '왜요?' }, reactions: [] };
    const f = (async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(out) } }] }))) as unknown as typeof fetch;
    const q = { id: 'q1', stage: 'experience', askedBy: 'iv1', text: 't', intent: '', mustHit: [], redFlags: [], evidenceIds: [], answerOutline: '', followUpSeeds: [] };
    const r = await handleScore(post('/api/score', { sid, lang: 'ko', question: q, answer: 'a', thread: [], evidence: [], history: [], interviewers: [{ id: 'iv1', role: 'hr', rank: 'lead', gender: 'none', personality: 'warm', seed: 1 }], followUpsUsed: 0, followUpLimit: 1 }), env, f);
    const j = (await r.json()) as { data: { followUp: { askedBy: string } } };
    expect(j.data.followUp.askedBy).toBe('');
  });
});
