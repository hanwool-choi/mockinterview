import { describe, it, expect } from 'vitest';
import { signDevice, verifyDevice, reserveSlot, bumpSessionCall, createSession, checkOrigin, kstDay } from '../../functions/_lib/security';
import { memKV } from './memkv';

describe('device token', () => {
  it('round-trips and rejects tampering', async () => {
    const t = await signDevice('sec', 'dev1', '2026-10-31');
    expect(await verifyDevice('sec', t)).toBe('dev1');
    expect(await verifyDevice('sec', t.replace('dev1', 'dev2'))).toBeNull();
    expect(await verifyDevice('other', t)).toBeNull();
    expect(await verifyDevice('sec', 'garbage')).toBeNull();
  });
});

describe('reserveSlot', () => {
  it('allows 3 per device then reports device limit', async () => {
    const env = { IV_KV: memKV() } as never;
    for (let i = 0; i < 3; i++) expect((await reserveSlot(env, 'd1', '2026-10-31')).ok).toBe(true);
    expect(await reserveSlot(env, 'd1', '2026-10-31')).toEqual({ ok: false, reason: 'device' });
  });
  it('reports global limit', async () => {
    const env = { IV_KV: memKV(), DAILY_GLOBAL_INTERVIEWS: '1' } as never;
    expect((await reserveSlot(env, 'a', '2026-10-31')).ok).toBe(true);
    expect(await reserveSlot(env, 'b', '2026-10-31')).toEqual({ ok: false, reason: 'global' });
  });
});

describe('bumpSessionCall', () => {
  it('caps score at 16 and plan at 1; unknown session is rejected', async () => {
    const env = { IV_KV: memKV() } as never;
    const sid = await createSession(env, 'dev');
    for (let i = 0; i < 16; i++) expect(await bumpSessionCall(env, sid, 'score')).toBe('ok');
    expect(await bumpSessionCall(env, sid, 'score')).toBe('limit');
    expect(await bumpSessionCall(env, sid, 'plan')).toBe('ok');
    expect(await bumpSessionCall(env, sid, 'plan')).toBe('limit');
    expect(await bumpSessionCall(env, 'nope', 'plan')).toBe('unknown');
  });
});

describe('checkOrigin / kstDay', () => {
  it('accepts same-origin and missing origin, rejects foreign', () => {
    const mk = (o?: string) => new Request('https://app.example/api/x', { method: 'POST', headers: o ? { Origin: o } : {} });
    expect(checkOrigin(mk('https://app.example'), {} as never)).toBe(true);
    expect(checkOrigin(mk(), {} as never)).toBe(true);
    expect(checkOrigin(mk('https://evil.example'), {} as never)).toBe(false);
  });
  it('computes KST day (UTC+9)', () => {
    expect(kstDay(new Date('2026-10-31T15:30:00Z'))).toBe('2026-11-01');
  });
});
