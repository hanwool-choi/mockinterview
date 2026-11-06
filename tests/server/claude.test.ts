import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { callJson } from '../../functions/_lib/llm';
import { claudeCost, toClaude } from '../../functions/_lib/claude';
import { memKV } from './memkv';

const schema = z.object({ a: z.number() });
const env = (extra: Record<string, unknown> = {}) => ({ IV_KV: memKV(), ANTHROPIC_API_KEY: 'sk-ant-test', ...extra }) as never;
const message = (text: string, stop = 'end_turn', extra: Record<string, unknown> = {}) =>
  Response.json({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text }], stop_reason: stop, stop_sequence: null, usage: { input_tokens: 2500, output_tokens: 1100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, ...extra });
const gemini = (text: string) => Response.json({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 1000, completion_tokens: 200 } });
const sent: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
const route = (claude: () => Response) =>
  (async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u instanceof Request ? u.url : u);
    sent.push({ url, body: JSON.parse(String(init?.body ?? '{}')), headers: new Headers(init?.headers) });
    return url.includes('anthropic.com') ? claude() : gemini('{"a":2}');
  }) as typeof fetch;

describe('Claude provider', () => {
  it('goes first, at the lowest thinking setting, without sampling parameters, and prices Sonnet 5.5 at $2/$10', async () => {
    sent.length = 0;
    const r = await callJson(env({ GEMINI_API_KEY: 'g' }), { messages: [{ role: 'system', content: 'JSON only' }, { role: 'user', content: 'hi' }], schema, timeoutMs: 5000, maxTokens: 1800, fetchFn: route(() => message('{"a":1}')), fake: () => ({ a: 0 }) });
    expect(r).toMatchObject({ ok: true, data: { a: 1 }, model: 'claude:claude-sonnet-5-5' });
    const req = sent[0];
    expect(req.url).toContain('api.anthropic.com/v1/messages');
    expect(req.headers.get('authorization') ?? req.headers.get('x-api-key')).toMatch(/sk-ant-test/);
    expect(req.body).toMatchObject({ model: 'claude-sonnet-5-5', max_tokens: 1800, system: 'JSON only', thinking: { type: 'between_tools' }, output_config: { effort: 'low' } });
    expect(req.body).not.toHaveProperty('temperature');
    expect(r.usage.costUsd).toBeCloseTo(2500 * 2e-6 + 1100 * 10e-6, 9);
  });
  it('a decline moves on to Gemini and is still counted in the cost', async () => {
    sent.length = 0;
    const r = await callJson(env({ GEMINI_API_KEY: 'g', GEMINI_MODELS: 'm1' }), { messages: [{ role: 'user', content: 'hi' }], schema, timeoutMs: 5000, fetchFn: route(() => message('', 'refusal', { stop_details: { type: 'refusal', category: 'general_harms', explanation: null } })), fake: () => ({ a: 0 }) });
    expect(r).toMatchObject({ ok: true, data: { a: 2 }, model: 'gemini:m1' });
    expect(r.usage.calls).toBe(2);
    expect(r.usage.costUsd).toBeGreaterThan(0.015);
  });
  it('a rate limit or server error moves on to Gemini (no SDK retries)', async () => {
    sent.length = 0;
    const r = await callJson(env({ GEMINI_API_KEY: 'g', GEMINI_MODELS: 'm1' }), { messages: [{ role: 'user', content: 'hi' }], schema, timeoutMs: 5000, fetchFn: route(() => Response.json({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, { status: 429 })), fake: () => ({ a: 0 }) });
    expect(r).toMatchObject({ ok: true, model: 'gemini:m1' });
    expect(sent.filter((s) => s.url.includes('anthropic.com'))).toHaveLength(1);
  });
  it('demo mode only when no provider key is set at all', async () => {
    const r = await callJson(env(), { messages: [], schema, timeoutMs: 1000, fetchFn: route(() => message('{"a":5}')), fake: () => ({ a: 0 }) });
    expect(r).toMatchObject({ ok: true, model: 'claude:claude-sonnet-5-5' });
  });
});

describe('message conversion', () => {
  it('moves system text apart and turns image data URLs into base64 image blocks before the text', () => {
    const c = toClaude([
      { role: 'system', content: 'rules' },
      { role: 'user', content: [{ type: 'text', text: 'read this' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } }] },
    ]);
    expect(c.system).toBe('rules');
    expect(c.messages[0].content).toEqual([{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } }, { type: 'text', text: 'read this' }]);
  });
  it('prices cache reads at a tenth of input', () => {
    expect(claudeCost({} as never, 'claude-sonnet-5-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.2, 9);
  });
});

describe('Claude off when credits run out or the key is bad', () => {
  const err = (status: number, type: string, msg: string) => () => Response.json({ type: 'error', error: { type, message: msg } }, { status });
  for (const [label, res, reason] of [
    ['402 billing_error', err(402, 'billing_error', 'Your credit balance is too low to access the Anthropic API.'), 'billing'],
    ['400 low credit balance', err(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'), 'billing'],
    ['401 bad key', err(401, 'authentication_error', 'invalid x-api-key'), 'auth'],
  ] as const) {
    it(`${label}: switches to Gemini and skips Claude for an hour`, async () => {
      sent.length = 0;
      const e = env({ GEMINI_API_KEY: 'g', GEMINI_MODELS: 'm1' });
      const first = await callJson(e, { messages: [{ role: 'user', content: 'hi' }], schema, timeoutMs: 5000, fetchFn: route(res), fake: () => ({ a: 0 }) });
      expect(first).toMatchObject({ ok: true, model: 'gemini:m1' });
      expect(JSON.parse((await (e as { IV_KV: KVNamespace }).IV_KV.get('claude:off'))!)).toMatchObject({ reason });
      sent.length = 0;
      const second = await callJson(e, { messages: [{ role: 'user', content: 'hi' }], schema, timeoutMs: 5000, fetchFn: route(res), fake: () => ({ a: 0 }) });
      expect(second).toMatchObject({ ok: true, model: 'gemini:m1' });
      expect(sent.some((s) => s.url.includes('anthropic.com'))).toBe(false);
    });
  }
  it('an ordinary bad request does not switch Claude off', async () => {
    const e = env({ GEMINI_API_KEY: 'g', GEMINI_MODELS: 'm1' });
    await callJson(e, { messages: [{ role: 'user', content: 'hi' }], schema, timeoutMs: 5000, fetchFn: route(err(400, 'invalid_request_error', 'messages: field required')), fake: () => ({ a: 0 }) });
    expect(await (e as { IV_KV: KVNamespace }).IV_KV.get('claude:off')).toBeNull();
  });
});
