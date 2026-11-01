import type { SessionRequest } from '../../shared/api';
import type { Env } from '../_lib/env';
import { guard, json, readJson } from '../_lib/http';
import { checkOrigin, createSession, deviceSecret, hashIp, kstDay, randomId, reserveSlot, signDevice, verifyDevice, verifyTurnstile } from '../_lib/security';

export async function handleSession(req: Request, env: Env): Promise<Response> {
  return guard(async () => {
    if (!checkOrigin(req, env)) return json(403, { error: 'origin' });
    // With a real key the shared budget is at stake: refuse to run without abuse protection configured.
    // Local development (localhost only) may run a real key without Turnstile.
    const local = ['localhost', '127.0.0.1'].includes(new URL(req.url).hostname);
    if (env.OPENROUTER_API_KEY && (!env.DEVICE_SECRET || (!env.TURNSTILE_SECRET && !local))) return json(503, { error: 'misconfigured' });
    const body = await readJson<SessionRequest>(req, 4_000);
    if (!local && !(await verifyTurnstile(env, body.turnstileToken, req.headers.get('CF-Connecting-IP')))) return json(403, { error: 'turnstile' });
    const secret = deviceSecret(env);
    const deviceId = (body.deviceToken && (await verifyDevice(secret, body.deviceToken))) || randomId();
    const day = kstDay();
    const slot = await reserveSlot(env, deviceId, day, await hashIp(secret, req.headers.get('CF-Connecting-IP')));
    if (!slot.ok) return json(429, { reason: slot.reason });
    const sid = await createSession(env, deviceId);
    return json(200, { sid, deviceToken: await signDevice(secret, deviceId, day), remaining: slot.remaining ?? 0 });
  });
}

export const onRequestPost: PagesFunction<Env> = (ctx) => handleSession(ctx.request, ctx.env);
