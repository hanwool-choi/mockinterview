import { SESSION_CAPS, type QuotaReason } from '../../shared/api';
import { type Env, intVar } from './env';

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

export const deviceSecret = (env: Env) => env.DEVICE_SECRET || 'dev-only-insecure-secret';
export const randomId = () => hex(crypto.getRandomValues(new Uint8Array(12)).buffer as ArrayBuffer);

export async function signDevice(secret: string, id: string, day: string): Promise<string> {
  return `${id}.${day}.${await hmac(secret, `${id}.${day}`)}`;
}

export async function verifyDevice(secret: string, token: string): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, day, sig] = parts;
  const expect = await hmac(secret, `${id}.${day}`);
  if (expect.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? id : null;
}

export async function verifyTurnstile(env: Env, token: string | undefined, ip: string | null): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const body = (await r.json()) as { success?: boolean };
  return body.success === true;
}

export function kstDay(d = new Date()): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

const TWO_DAYS = 2 * 86400;

export async function hashIp(secret: string, ip: string | null): Promise<string | undefined> {
  return ip ? (await hmac(secret, `ip:${ip}`)).slice(0, 24) : undefined;
}

/** Daily quota. The IP counter stops clients that simply drop their device token. KV is not atomic: caps are best-effort under concurrent abuse. */
export async function reserveSlot(env: Env, deviceId: string, day: string, ipHash?: string): Promise<{ ok: boolean; reason?: QuotaReason; remaining?: number }> {
  const gKey = `quota:g:${day}`;
  const dKey = `quota:d:${day}:${deviceId}`;
  const iKey = ipHash ? `quota:i:${day}:${ipHash}` : null;
  const g = Number((await env.IV_KV.get(gKey)) ?? 0);
  const d = Number((await env.IV_KV.get(dKey)) ?? 0);
  const ipCount = iKey ? Number((await env.IV_KV.get(iKey)) ?? 0) : 0;
  const gMax = intVar(env.DAILY_GLOBAL_INTERVIEWS, 75);
  const dMax = intVar(env.DAILY_DEVICE_INTERVIEWS, 3);
  const iMax = intVar(env.DAILY_IP_INTERVIEWS, 6);
  if (g >= gMax) return { ok: false, reason: 'global' };
  if (d >= dMax || ipCount >= iMax) return { ok: false, reason: 'device' };
  await env.IV_KV.put(gKey, String(g + 1), { expirationTtl: TWO_DAYS });
  await env.IV_KV.put(dKey, String(d + 1), { expirationTtl: TWO_DAYS });
  if (iKey) await env.IV_KV.put(iKey, String(ipCount + 1), { expirationTtl: TWO_DAYS });
  return { ok: true, remaining: dMax - d - 1 };
}

type Counts = Record<keyof typeof SESSION_CAPS, number>;
const SIX_HOURS = 6 * 3600;

export async function createSession(env: Env, deviceId: string): Promise<string> {
  const sid = randomId();
  const counts: Counts = { plan: 0, score: 0, report: 0 };
  await env.IV_KV.put(`sess:${sid}`, JSON.stringify({ deviceId, counts }), { expirationTtl: SIX_HOURS });
  return sid;
}

export async function bumpSessionCall(env: Env, sid: string, kind: keyof typeof SESSION_CAPS): Promise<'ok' | 'limit' | 'unknown'> {
  if (!sid || typeof sid !== 'string' || sid.length > 64) return 'unknown';
  const key = `sess:${sid}`;
  const s = (await env.IV_KV.get(key, 'json')) as { deviceId: string; counts: Counts } | null;
  if (!s) return 'unknown';
  if (s.counts[kind] >= SESSION_CAPS[kind]) return 'limit';
  s.counts[kind]++;
  await env.IV_KV.put(key, JSON.stringify(s), { expirationTtl: SIX_HOURS });
  return 'ok';
}

export function checkOrigin(req: Request, env: Env): boolean {
  const origin = req.headers.get('Origin');
  if (!origin) return true;
  const self = new URL(req.url).origin;
  if (origin === self) return true;
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin);
}
