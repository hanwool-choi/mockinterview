import type { SessionRequest } from '../../shared/api';
import { isFake, type Env } from '../_lib/env';
import { guard, json, readJson } from '../_lib/http';
import { checkOrigin, createSession, deviceSecret, kstDay, randomId, signDevice, verifyDevice, checkTurnstile } from '../_lib/security';
import { dailyLeft, paused } from '../_lib/budget';

export async function handleSession(req: Request, env: Env): Promise<Response> {
  return guard(async () => {
    if (!checkOrigin(req, env)) return json(403, { error: 'origin' });
    // With a real key the shared budget is at stake: refuse to run without abuse protection configured.
    // Local development (localhost only) may run a real key without Turnstile.
    const local = ['localhost', '127.0.0.1'].includes(new URL(req.url).hostname);
    if (!isFake(env) && (!env.DEVICE_SECRET || (!env.TURNSTILE_SECRET && !local))) return json(503, { error: `misconfigured ${[!env.DEVICE_SECRET && 'DEVICE_SECRET', !env.TURNSTILE_SECRET && 'TURNSTILE_SECRET'].filter(Boolean).join(',')}` });
    const body = await readJson<SessionRequest>(req, 4_000);
    if (!local) {
      const ts = await checkTurnstile(env, body.turnstileToken, req.headers.get('CF-Connecting-IP'));
      if (!ts.ok) return json(403, { error: `turnstile ${ts.codes.join(',')}`.trim() });
    }
    const secret = deviceSecret(env);
    const deviceId = (body.deviceToken && (await verifyDevice(secret, body.deviceToken))) || randomId();
    const day = kstDay();
    // No interview count limit: cost is bounded by the session and daily budgets instead (functions/_lib/budget.ts).
    const sid = await createSession(env, deviceId, body.length === 'quick' ? 'quick' : 'full');
    const ai = (await paused(env)) ? 'paused' : (await dailyLeft(env)) <= 0 ? 'budget' : 'on';
    return json(200, { sid, deviceToken: await signDevice(secret, deviceId, day), ai });
  });
}

export const onRequestPost: PagesFunction<Env> = (ctx) => handleSession(ctx.request, ctx.env);
