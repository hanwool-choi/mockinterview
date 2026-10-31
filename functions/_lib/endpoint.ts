import type { SESSION_CAPS } from '../../shared/api';
import type { Env } from './env';
import { HttpFail, readJson } from './http';
import { bumpSessionCall, checkOrigin } from './security';

/** Shared preamble: origin check, size-limited body, session call cap. */
export async function admit<T extends { sid: string }>(req: Request, env: Env, kind: keyof typeof SESSION_CAPS, maxBytes: number): Promise<T> {
  if (!checkOrigin(req, env)) throw new HttpFail(403, { error: 'origin' });
  const body = await readJson<T>(req, maxBytes);
  const r = await bumpSessionCall(env, body?.sid, kind);
  if (r === 'unknown') throw new HttpFail(401, { error: 'session' });
  if (r === 'limit') throw new HttpFail(429, { reason: 'session' });
  return body;
}
