import type { Env } from './env';

export type OpenRouterModel = { id: string; context_length?: number; pricing?: { prompt?: string; completion?: string }; architecture?: { input_modalities?: string[]; output_modalities?: string[] } };

/** Used only when the live model list cannot be fetched. Free model ids change often. */
export const DEFAULT_FREE_MODELS = [
  'nvidia/nemotron-3.5-super-vl:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'dots-studio/dots-3-note-preview:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'google/gemma-4-31b-it:free',
];

const CACHE_KEY = 'models:free:v2';
const TTL_MS = 6 * 3600 * 1000;

export function selectFreeModels(list: OpenRouterModel[], preferred: string[]): string[] {
  // Real-run finding: price-0 lists include music/image generators (e.g. lyria) and paid previews. Keep :free text->text chat models only.
  const textOnly = (m: OpenRouterModel) => {
    const out = m.architecture?.output_modalities;
    const inp = m.architecture?.input_modalities;
    return (!out || (out.length === 1 && out[0] === 'text')) && (!inp || inp.includes('text'));
  };
  const free = list.filter(
    (m) => m.id.endsWith(':free') && textOnly(m) && !/content-safety|guard/i.test(m.id) &&
      Number(m.pricing?.prompt ?? 1) === 0 && Number(m.pricing?.completion ?? 1) === 0 && (m.context_length ?? 0) >= 32000,
  );
  const rank = (id: string) => {
    const i = preferred.findIndex((p) => p && id.toLowerCase().includes(p.toLowerCase()));
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return free
    .sort((a, b) => rank(a.id) - rank(b.id) || (b.context_length ?? 0) - (a.context_length ?? 0))
    .map((m) => m.id);
}

export async function getFreeModels(env: Env, fetchFn: typeof fetch = fetch): Promise<string[]> {
  const cached = (await env.IV_KV.get(CACHE_KEY, 'json')) as { at: number; ids: string[] } | null;
  if (cached && Date.now() - cached.at < TTL_MS && cached.ids.length) return cached.ids;
  try {
    const res = await fetchFn('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error(`models ${res.status}`);
    const body = (await res.json()) as { data: OpenRouterModel[] };
    const ids = selectFreeModels(body.data ?? [], (env.PREFERRED_MODELS ?? '').split(',').map((s) => s.trim()));
    if (!ids.length) throw new Error('no free models');
    await env.IV_KV.put(CACHE_KEY, JSON.stringify({ at: Date.now(), ids }));
    return ids;
  } catch {
    return cached?.ids?.length ? cached.ids : DEFAULT_FREE_MODELS;
  }
}

/** Remember failing models so the next call skips them: gated/removed for a day, rate-limited for a few minutes. */
export async function markModel(env: Env, model: string, status: number): Promise<void> {
  const ttl = status === 403 || status === 404 || status === 400 ? 24 * 3600 : status === 402 ? 600 : status === 429 || status >= 500 ? 180 : 0;
  if (!ttl) return;
  await env.IV_KV.put(`model:bad:${model}`, String(status), { expirationTtl: Math.max(60, ttl) });
}

export async function healthyModels(env: Env, ids: string[]): Promise<string[]> {
  const flags = await Promise.all(ids.map((id) => env.IV_KV.get(`model:bad:${id}`)));
  const ok = ids.filter((_, i) => !flags[i]);
  return ok.length ? ok : ids;
}
