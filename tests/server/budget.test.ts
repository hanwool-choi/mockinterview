import { describe, it, expect } from 'vitest';
import { memKV } from './memkv';
import { createSession, kstDay } from '../../functions/_lib/security';
import { charge, gate, readDay, SESSION_BUDGET_USD } from '../../functions/_lib/budget';

const env = (extra: Record<string, unknown> = {}) => ({ IV_KV: memKV(), ...extra }) as never;
const use = (costUsd: number) => ({ calls: 1, tokensIn: 1000, tokensOut: 200, costUsd });
// Sessions are counted on the real (KST) day they start, so the ledger day must be today too.
const DAY = kstDay();

describe('budget gate', () => {
  it('default caps: quick $0.15, full $0.50 per session', () => {
    expect(SESSION_BUDGET_USD).toEqual({ quick: 0.15, full: 0.5 });
  });

  it('lets a fresh session through and counts the call', async () => {
    const e = env();
    const sid = await createSession(e, 'dev', 'full');
    const g = await gate(e, sid, 'score', { day: DAY, now: 10_000 });
    expect(g.ok).toBe(true);
  });

  it('stops a session once its cost reaches the cap for its length', async () => {
    const e = env();
    const sid = await createSession(e, 'dev', 'quick');
    await charge(e, sid, 'score', 'gemini:gemini-3.5-flash-lite', use(SESSION_BUDGET_USD.quick + 0.001), { day: DAY });
    const g = await gate(e, sid, 'score', { day: DAY, now: 100_000 });
    expect(g).toMatchObject({ ok: false, status: 429, reason: 'budget' });
  });

  it('stops everyone once the daily budget is spent', async () => {
    const e = env({ DAILY_BUDGET_USD: '0.01' });
    const a = await createSession(e, 'dev-a', 'full');
    await charge(e, a, 'score', 'm', use(0.011), { day: DAY });
    const b = await createSession(e, 'dev-b', 'full');
    expect(await gate(e, b, 'score', { day: DAY, now: 100_000 })).toMatchObject({ ok: false, reason: 'budget' });
  });

  it('kill switch from env or KV pauses all AI calls', async () => {
    const e1 = env({ AI_KILL_SWITCH: 'on' });
    const s1 = await createSession(e1, 'dev', 'full');
    expect(await gate(e1, s1, 'score', { day: DAY, now: 1 })).toMatchObject({ ok: false, status: 503, reason: 'paused' });
    const e2 = env();
    const s2 = await createSession(e2, 'dev', 'full');
    await (e2 as { IV_KV: KVNamespace }).IV_KV.put('ai:kill', '1');
    expect(await gate(e2, s2, 'score', { day: DAY, now: 1 })).toMatchObject({ ok: false, reason: 'paused' });
  });

  it('rejects bursts from one session (server-side request limit)', async () => {
    const e = env();
    const sid = await createSession(e, 'dev', 'full');
    expect((await gate(e, sid, 'score', { day: DAY, now: 50_000 })).ok).toBe(true);
    expect(await gate(e, sid, 'score', { day: DAY, now: 50_500 })).toMatchObject({ ok: false, status: 429, reason: 'rate' });
    expect((await gate(e, sid, 'score', { day: DAY, now: 53_000 })).ok).toBe(true);
  });

  it('unknown session and per-session call caps still apply', async () => {
    const e = env();
    expect(await gate(e, 'nope', 'score', { day: DAY, now: 1 })).toMatchObject({ ok: false, status: 401 });
    const sid = await createSession(e, 'dev', 'full');
    expect((await gate(e, sid, 'report', { day: DAY, now: 1 })).ok).toBe(true);
    expect(await gate(e, sid, 'report', { day: DAY, now: 99_999 })).toMatchObject({ ok: false, reason: 'session' });
  });
});

describe('usage ledger', () => {
  it('records tokens and cost per session, per day (by kind and model) and per device', async () => {
    const e = env();
    const sid = await createSession(e, 'dev-1', 'full');
    await charge(e, sid, 'score', 'qwen/qwen3.7-flash', use(0.0002), { day: DAY });
    await charge(e, sid, 'report', 'deepseek/deepseek-v4.1-flash', { calls: 2, tokensIn: 3000, tokensOut: 900, costUsd: 0.0005 }, { day: DAY });
    const d = await readDay(e, DAY);
    expect(d.calls).toBe(3);
    expect(d.tokensIn).toBe(4000);
    expect(d.costUsd).toBeCloseTo(0.0007, 9);
    expect(d.kinds.score.calls).toBe(1);
    expect(d.models['deepseek/deepseek-v4.1-flash'].costUsd).toBeCloseTo(0.0005, 9);
    expect(d.sessions).toBe(1);
    const dev = JSON.parse((await (e as { IV_KV: KVNamespace }).IV_KV.get(`usage:u:${DAY}:dev-1`))!);
    expect(dev.costMicro).toBe(700);
  });
});
