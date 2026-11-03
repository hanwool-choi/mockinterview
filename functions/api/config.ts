import type { Env } from '../_lib/env';
import { isFake } from '../_lib/env';
import { json } from '../_lib/http';

export type DonateLinks = { kakao: string; fairy: string };

/** Only https links on the expected host reach the page. */
function onHost(u: string | undefined, host: string): string {
  try {
    const url = new URL(u ?? '');
    return url.protocol === 'https:' && url.hostname === host ? url.toString() : '';
  } catch {
    return '';
  }
}

export function donateLinks(env: Pick<Env, 'KAKAOPAY_URL' | 'FAIRY_URL'>): DonateLinks {
  return { kakao: onHost(env.KAKAOPAY_URL, 'qr.kakaopay.com'), fairy: onHost(env.FAIRY_URL, 'fairy.hada.io') };
}

/** Names of settings a real-AI deployment needs but lacks (names only, never values), so a failed start can be diagnosed from a browser. */
export function missing(env: Env): string[] {
  if (isFake(env)) return [];
  const out: string[] = [];
  if (!env.DEVICE_SECRET) out.push('DEVICE_SECRET');
  if (!env.TURNSTILE_SECRET) out.push('TURNSTILE_SECRET');
  if (!env.TURNSTILE_SITEKEY) out.push('TURNSTILE_SITEKEY');
  if (!env.IV_KV) out.push('IV_KV');
  return out;
}

export const onRequestGet: PagesFunction<Env> = (ctx) =>
  json(200, { turnstileSiteKey: ctx.env.TURNSTILE_SITEKEY || '', fake: isFake(ctx.env), missing: missing(ctx.env), donate: donateLinks(ctx.env) });
