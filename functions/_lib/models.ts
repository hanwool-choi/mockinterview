import type { Env } from './env';

export type OpenRouterModel = { id: string; context_length?: number; pricing?: { prompt?: string; completion?: string } };

/** Used only when the live model list cannot be fetched. Free model ids change often. */
export const DEFAULT_FREE_MODELS = [
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
];

const CACHE_KEY = 'models:free';
const TTL_MS = 6 * 3600 * 1000;

export function selectFreeModels(list: OpenRouterModel[], preferred: string[]): string[] {
  const free = list.filter(
    (m) => Number(m.pricing?.prompt ?? 1) === 0 && Number(m.pricing?.completion ?? 1) === 0 && (m.context_length ?? 0) >= 32000,
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
