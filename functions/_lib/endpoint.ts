import type { Env } from './env';
import { gate, type CallKind } from './budget';
import { HttpFail, readJson } from './http';
import { checkOrigin } from './security';

/** Shared preamble: origin check, size-limited body, then the cost gate (kill switch, caps, request gap, budgets). */
export async function admit<T extends { sid: string }>(req: Request, env: Env, kind: CallKind, maxBytes: number): Promise<T> {
  if (!checkOrigin(req, env)) throw new HttpFail(403, { error: 'origin' });
  const body = await readJson<T>(req, maxBytes);
  const g = await gate(env, body?.sid, kind);
  if (!g.ok) throw new HttpFail(g.status, g.reason === 'unknown' ? { error: 'session' } : { reason: g.reason });
  return body;
}
