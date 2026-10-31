import type { Env } from '../_lib/env';
import { isFake } from '../_lib/env';
import { json } from '../_lib/http';

export const onRequestGet: PagesFunction<Env> = (ctx) =>
  json(200, { turnstileSiteKey: ctx.env.TURNSTILE_SITEKEY || '', fake: isFake(ctx.env) });
