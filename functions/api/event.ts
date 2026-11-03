import type { Env } from '../_lib/env';
import { json } from '../_lib/http';

const NAMES = new Set(['start', 'complete', 'drop', 'rating', 'fallback', 'support_click']);

/** Privacy-safe product metrics: event name + one short label + one number. No text, no ids. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const b = (await request.json()) as { name?: string; label?: string; value?: number };
    if (!b.name || !NAMES.has(b.name)) return json(400, { error: 'name' });
    env.EVENTS?.writeDataPoint({ blobs: [b.name, String(b.label ?? '').slice(0, 32)], doubles: [Number(b.value) || 0] });
    return json(200, { ok: true });
  } catch {
    return json(400, { error: 'bad' });
  }
};
