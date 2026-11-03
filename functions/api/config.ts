import type { Env } from '../_lib/env';
import { isFake } from '../_lib/env';
import { json } from '../_lib/http';

export const onRequestGet: PagesFunction<Env> = (ctx) =>
  json(200, { turnstileSiteKey: ctx.env.TURNSTILE_SITEKEY || '', fake: isFake(ctx.env), donateUrl: safeUrl(ctx.env.DONATE_URL) });

/** Only an https URL is passed to the page. */
export function safeUrl(u?: string): string {
  try {
    return u && new URL(u).protocol === 'https:' ? u : '';
  } catch {
    return '';
  }
}
