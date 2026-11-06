import { paused, readDay } from '../_lib/budget';
import { CLAUDE_OFF_KEY, claudeOff } from '../_lib/claude';
import type { Env } from '../_lib/env';
import { guard, json, readJson } from '../_lib/http';

/**
 * Operator endpoint (Authorization: Bearer ADMIN_TOKEN).
 *   GET  /api/usage?day=YYYY-MM-DD  → that day's calls, tokens, cost by kind and model, sessions, budget, paused,
 *                                     and claudeOff: why Claude is being skipped right now (no credits, bad key) or null
 *   POST /api/usage {"paused": true|false} → the kill switch, without a redeploy
 *   POST /api/usage {"claudeOn": true}      → use Claude again right away (after topping up credits), not after the hour
 */
export async function handleUsage(req: Request, env: Env): Promise<Response> {
  return guard(async () => {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json(401, { error: 'unauthorized' });
    if (req.method === 'POST') {
      const body = await readJson<{ paused?: boolean; claudeOn?: boolean }>(req, 1_000);
      if (body.claudeOn) {
        await env.IV_KV.delete(CLAUDE_OFF_KEY);
        return json(200, { claudeOff: await claudeOff(env) });
      }
      if (body.paused) await env.IV_KV.put('ai:kill', '1');
      else await env.IV_KV.delete('ai:kill');
      return json(200, { paused: await paused(env) });
    }
    const day = new URL(req.url).searchParams.get('day') ?? undefined;
    return json(200, { ...(await readDay(env, day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined)), paused: await paused(env), claudeOff: await claudeOff(env) });
  });
}

export const onRequestGet: PagesFunction<Env> = (ctx) => handleUsage(ctx.request, ctx.env);
export const onRequestPost: PagesFunction<Env> = (ctx) => handleUsage(ctx.request, ctx.env);
