import { newSession, type Length } from './budget';
import type { Env } from './env';

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


export async function hashIp(secret: string, ip: string | null): Promise<string | undefined> {
  return ip ? (await hmac(secret, `ip:${ip}`)).slice(0, 24) : undefined;
}

export async function createSession(env: Env, deviceId: string, length: Length = 'full'): Promise<string> {
  const sid = randomId();
  await newSession(env, sid, deviceId, length);
  return sid;
}

export function checkOrigin(req: Request, env: Env): boolean {
  const origin = req.headers.get('Origin');
  if (!origin) return true;
  const self = new URL(req.url).origin;
  if (origin === self) return true;
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin);
}
