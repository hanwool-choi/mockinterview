import { describe, it, expect } from 'vitest';
import { memKV } from './memkv';
import { handleUsage } from '../../functions/api/usage';
import { charge } from '../../functions/_lib/budget';
import { kstDay } from '../../functions/_lib/security';

const req = (method: string, token?: string, body?: unknown) =>
  new Request('https://app.example/api/usage', { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

describe('/api/usage (operator only)', () => {
  it('refuses without the admin token, and when no token is configured', async () => {
    expect((await handleUsage(req('GET'), { IV_KV: memKV(), ADMIN_TOKEN: 'secret' } as never)).status).toBe(401);
    expect((await handleUsage(req('GET', 'x'), { IV_KV: memKV() } as never)).status).toBe(401);
  });
  it('returns today’s ledger and toggles the kill switch', async () => {
    const env = { IV_KV: memKV(), ADMIN_TOKEN: 'secret' } as never;
    await charge(env, null, 'ocr', 'qwen/qwen3.7-flash', { calls: 1, tokensIn: 900, tokensOut: 300, costUsd: 0.0001 });
    const r = await handleUsage(req('GET', 'secret'), env);
    const j = (await r.json()) as { day: string; costUsd: number; paused: boolean };
    expect(j.day).toBe(kstDay());
    expect(j.costUsd).toBeCloseTo(0.0001, 9);
    expect(j.paused).toBe(false);
    await handleUsage(req('POST', 'secret', { paused: true }), env);
    expect(((await (await handleUsage(req('GET', 'secret'), env)).json()) as { paused: boolean }).paused).toBe(true);
    await handleUsage(req('POST', 'secret', { paused: false }), env);
    expect(((await (await handleUsage(req('GET', 'secret'), env)).json()) as { paused: boolean }).paused).toBe(false);
  });
});
