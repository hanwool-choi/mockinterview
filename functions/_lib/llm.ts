import type { ZodType } from 'zod';
import { type Env, intVar, isFake } from './env';
import { getFreeModels, healthyModels, markModel } from './models';

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] };
export type CallResult<T> = { ok: true; data: T; model: string } | { ok: false; fallback: true; errors: string[] };

export function parseModelJson(raw: string): unknown | null {
  if (!raw) return null;
  const s = raw.replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
}

class HttpError extends Error {
  constructor(msg: string, public status: number) {
    super(msg);
  }
}

/**
 * Free and cheap models think before answering by default; for our short JSON tasks that made each call
 * 4-5x slower (score: ~50-60s with thinking, ~10-12s without), so calls ran out of time and fell back.
 * Reasoning is switched off unless LLM_REASONING=on; a provider that rejects the switch is retried without it.
 */
async function chatOnce(env: Env, model: string, messages: ChatMessage[], timeoutMs: number, fetchFn: typeof fetch): Promise<string> {
  const think = env.LLM_REASONING === 'on';
  const started = Date.now();
  try {
    return await chatRequest(env, model, messages, timeoutMs, fetchFn, !think);
  } catch (e) {
    const left = timeoutMs - (Date.now() - started);
    if (!think && e instanceof HttpError && e.status === 400 && left > 1000) return chatRequest(env, model, messages, left, fetchFn, false);
    throw e;
  }
}

async function chatRequest(env: Env, model: string, messages: ChatMessage[], timeoutMs: number, fetchFn: typeof fetch, noReasoning: boolean): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-mock-interview-4rq.pages.dev',
        'X-Title': 'AI Mock Interview',
      },
      body: JSON.stringify({ model, messages, temperature: 0.6, ...(noReasoning ? { reasoning: { enabled: false } } : {}) }),
    });
    if (!res.ok) {
      if (res.status === 429) {
        const body = await res.text().catch(() => '');
        if (body.includes('free-models-per-day')) {
          const reset = Number(body.match(/X-RateLimit-Reset"?\s*:\s*"?(\d{10,})/)?.[1] ?? 0);
          const ttl = reset > Date.now() ? Math.ceil((reset - Date.now()) / 1000) : 3600;
          await env.IV_KV.put('free:exhausted', '1', { expirationTtl: Math.max(60, Math.min(ttl, 86400)) });
        }
      }
      throw new HttpError(`${model}: HTTP ${res.status}`, res.status);
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

export async function callJson<T>(
  env: Env,
  opts: {
    messages: ChatMessage[];
    schema: ZodType<T>;
    timeoutMs: number;
    deadlineMs?: number;
    /** With paid models configured: time the free chain may use before switching to paid. */
    freeBudgetMs?: number;
    maxModels?: number;
    fetchFn?: typeof fetch;
    fake: () => T;
    validate?: (data: T) => boolean;
    /** Use image-capable models (OCR). */
    vision?: boolean;
  },
): Promise<CallResult<T>> {
  if (isFake(env)) return { ok: true, data: opts.fake(), model: 'fake' };
  const fetchFn = opts.fetchFn ?? fetch;
  // The account-wide free daily quota is exhausted: go straight to paid (or fallback) until it resets.
  const freeExhausted = !!(await env.IV_KV.get('free:exhausted'));
  const free = freeExhausted ? [] : (await healthyModels(env, await getFreeModels(env, fetchFn, { vision: opts.vision }))).slice(0, opts.maxModels ?? 5);
  const paid = env.PAID_OVERFLOW === 'on' ? (env.PAID_MODEL ?? '').split(',').map((m) => m.trim()).filter(Boolean) : [];
  const errors: string[] = [];
  const start = Date.now();
  // One overall deadline (kept below the client's timeout) so the fallback chain actually gets a turn.
  const end = start + (opts.deadlineMs ?? opts.timeoutMs * (free.length + paid.length));
  const freeEnd = paid.length ? Math.min(end, start + (opts.freeBudgetMs ?? Math.floor((end - start) / 2))) : end;

  const attempt = async (model: string, until: number, tries: number): Promise<T | null> => {
    let messages = opts.messages;
    for (let i = 0; i < tries; i++) {
      const left = until - Date.now();
      if (left <= 0) return null;
      const raw = await chatOnce(env, model, messages, Math.min(opts.timeoutMs, left), fetchFn);
      const parsed = opts.schema.safeParse(parseModelJson(raw));
      if (parsed.success && (!opts.validate || opts.validate(parsed.data))) return parsed.data;
      if (parsed.success) return null; // valid JSON in the wrong language: this model will not fix it, try the next
      messages = [
        ...opts.messages,
        { role: 'assistant', content: raw.slice(0, 4000) },
        { role: 'user', content: 'The previous output was not valid JSON for the required schema. Output ONLY the corrected JSON object, nothing else.' },
      ];
    }
    return null;
  };

  for (const model of free) {
    if (Date.now() >= freeEnd || (await env.IV_KV.get('free:exhausted'))) break;
    try {
      const data = await attempt(model, freeEnd, 2);
      if (data) return { ok: true, data, model };
      errors.push(`${model}: invalid json, wrong language or out of time`);
    } catch (e) {
      if (e instanceof HttpError) await markModel(env, model, e.status);
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  for (const model of paid) {
    if (Date.now() >= end) break;
    if (!(await takePaidCall(env))) {
      errors.push('paid: monthly cap reached');
      break;
    }
    try {
      const data = await attempt(model, end, 1);
      if (data) return { ok: true, data, model };
      errors.push(`${model}: invalid json, wrong language or out of time`);
    } catch (e) {
      if (e instanceof HttpError) await markModel(env, model, e.status);
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  // Model names and error kinds only: never request or response content.
  console.warn(`llm fallback after ${Date.now() - start}ms: ${errors.join(' | ') || 'no models available'}`);
  return { ok: false, fallback: true, errors };
}

/** Monthly cap on paid calls (best-effort KV counter). */
async function takePaidCall(env: Env): Promise<boolean> {
  const key = `paid:calls:${new Date().toISOString().slice(0, 7)}`;
  const n = Number((await env.IV_KV.get(key)) ?? 0);
  if (n >= intVar(env.PAID_MONTHLY_CALLS, 3000)) return false;
  await env.IV_KV.put(key, String(n + 1), { expirationTtl: 40 * 86400 });
  return true;
}
