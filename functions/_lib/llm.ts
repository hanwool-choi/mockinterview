import type { ZodType } from 'zod';
import { type Env, intVar, isFake } from './env';
import { getFreeModels, healthyModels, markModel } from './models';
import { CLAUDE_OFF_KEY, CLAUDE_PREFIX, ClaudeDecline, DEFAULT_CLAUDE_MODELS, claudeChat } from './claude';

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] };
/** Tokens and dollars spent by one callJson, across every attempt (failed ones cost money too). */
export type Usage = { calls: number; tokensIn: number; tokensOut: number; costUsd: number };
export const emptyUsage = (): Usage => ({ calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 });
export type CallResult<T> = ({ ok: true; data: T; model: string } | { ok: false; fallback: true; errors: string[] }) & { usage: Usage };
type Reply = { content: string; usage: Usage };

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
/** Models called through Google's Gemini API directly are written "gemini:<model>"; everything else goes to OpenRouter. */
const GEMINI_PREFIX = 'gemini:';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const DEFAULT_GEMINI_MODELS = 'gemini-2.5-flash-lite,gemini-3.5-flash-lite';
/** USD per 1M tokens (input/output), used only when GEMINI_TIER=paid. Override with GEMINI_PRICES "model:in/out,...". */
const GEMINI_PRICES: Record<string, [number, number]> = { 'gemini-2.5-flash-lite': [0.1, 0.4], 'gemini-3.5-flash-lite': [0.3, 2.5], 'gemini-3.8-flash': [0.825, 4.125] };

function geminiCost(env: Env, model: string, tokensIn: number, tokensOut: number): number {
  if (env.GEMINI_TIER !== 'paid') return 0; // free tier: Google does not bill, tokens are still counted
  const custom = Object.fromEntries(
    (env.GEMINI_PRICES ?? '').split(',').map((x) => x.trim().match(/^(.+):([\d.]+)\/([\d.]+)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], [Number(m[2]), Number(m[3])] as [number, number]]),
  );
  const [pin, pout] = custom[model] ?? GEMINI_PRICES[model] ?? [0, 0];
  return (tokensIn * pin + tokensOut * pout) / 1e6;
}

async function chatOnce(env: Env, model: string, messages: ChatMessage[], timeoutMs: number, fetchFn: typeof fetch, maxTokens?: number): Promise<Reply> {
  const think = env.LLM_REASONING === 'on';
  const started = Date.now();
  try {
    return await chatRequest(env, model, messages, timeoutMs, fetchFn, !think, maxTokens);
  } catch (e) {
    const left = timeoutMs - (Date.now() - started);
    if (!think && !model.startsWith(CLAUDE_PREFIX) && e instanceof HttpError && e.status === 400 && left > 1000) return chatRequest(env, model, messages, left, fetchFn, false, maxTokens);
    throw e;
  }
}

async function chatRequest(env: Env, model: string, messages: ChatMessage[], timeoutMs: number, fetchFn: typeof fetch, noReasoning: boolean, maxTokens?: number): Promise<Reply> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    if (model.startsWith(CLAUDE_PREFIX)) {
      try {
        return await claudeChat(env, model.slice(CLAUDE_PREFIX.length), messages, timeoutMs, fetchFn, maxTokens);
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (status !== undefined && !(e instanceof ClaudeDecline)) throw new HttpError((e as Error).message, status);
        throw e;
      }
    }
    if (model.startsWith(GEMINI_PREFIX)) {
      const m = model.slice(GEMINI_PREFIX.length);
      const res = await fetchFn(GEMINI_URL, {
        method: 'POST',
        signal: ctl.signal,
        headers: { Authorization: `Bearer ${env.GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, messages, temperature: 0.6, ...(maxTokens ? { max_tokens: maxTokens } : {}), // Thinking can be fully off only on 2.5 models; newer ones take the lowest level.
        ...(noReasoning ? { reasoning_effort: /gemini-2\.5/.test(m) ? 'none' : 'low' } : {}) }),
      });
      if (!res.ok) throw new HttpError(`${model}: HTTP ${res.status}`, res.status);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      const tin = body.usage?.prompt_tokens ?? 0;
      const tout = body.usage?.completion_tokens ?? 0;
      return { content: body.choices?.[0]?.message?.content ?? '', usage: { calls: 1, tokensIn: tin, tokensOut: tout, costUsd: geminiCost(env, m, tin, tout) } };
    }
    const res = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-mock-interview-4rq.pages.dev',
        'X-Title': 'AI Mock Interview',
      },
      // usage.include: OpenRouter returns tokens and the real cost in dollars with every reply.
      body: JSON.stringify({ model, messages, temperature: 0.6, usage: { include: true }, ...(maxTokens ? { max_tokens: maxTokens } : {}), ...(noReasoning ? { reasoning: { enabled: false } } : {}) }),
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
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number } };
    const u = body.usage ?? {};
    return { content: body.choices?.[0]?.message?.content ?? '', usage: { calls: 1, tokensIn: u.prompt_tokens ?? 0, tokensOut: u.completion_tokens ?? 0, costUsd: u.cost ?? 0 } };
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
    /** Upper bound on output tokens: keeps each call's cost predictable. */
    maxTokens?: number;
  },
): Promise<CallResult<T>> {
  const usage = emptyUsage();
  if (isFake(env)) return { ok: true, data: opts.fake(), model: 'fake', usage };
  const fetchFn = opts.fetchFn ?? fetch;
  // The account-wide free daily quota is exhausted: go straight to paid (or fallback) until it resets.
  const router = !!env.OPENROUTER_API_KEY;
  const freeExhausted = !router || !!(await env.IV_KV.get('free:exhausted'));
  // Claude goes first when its key is set, then Gemini (direct API); OpenRouter stays as the last fallback.
  // Skipped for an hour after running out of credits or a rejected key (claude.ts), so Gemini answers without a failed call first.
  const claude = env.ANTHROPIC_API_KEY && !(await env.IV_KV.get(CLAUDE_OFF_KEY)) ? await healthyModels(env, (env.CLAUDE_MODELS || DEFAULT_CLAUDE_MODELS).split(',').map((m) => m.trim()).filter(Boolean).map((m) => CLAUDE_PREFIX + m)) : [];
  // Gemini (direct API) goes first when its key is set: its free tier costs nothing; OpenRouter stays as the fallback.
  const gemini = env.GEMINI_API_KEY ? await healthyModels(env, (env.GEMINI_MODELS || DEFAULT_GEMINI_MODELS).split(',').map((m) => m.trim()).filter(Boolean).map((m) => GEMINI_PREFIX + m)) : [];
  const free = [...claude, ...gemini, ...(freeExhausted ? [] : (await healthyModels(env, await getFreeModels(env, fetchFn, { vision: opts.vision }))).slice(0, opts.maxModels ?? 5))];
  const paid = router && env.PAID_OVERFLOW === 'on' ? (env.PAID_MODEL ?? '').split(',').map((m) => m.trim()).filter(Boolean) : [];
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
      const reply = await chatOnce(env, model, messages, Math.min(opts.timeoutMs, left), fetchFn, opts.maxTokens);
      usage.calls += reply.usage.calls;
      usage.tokensIn += reply.usage.tokensIn;
      usage.tokensOut += reply.usage.tokensOut;
      usage.costUsd = Math.round((usage.costUsd + reply.usage.costUsd) * 1e9) / 1e9;
      const raw = reply.content;
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
    if (Date.now() >= freeEnd) break;
    // Only OpenRouter's free models share that daily quota; Claude and Gemini are billed per token.
    if (!model.startsWith(GEMINI_PREFIX) && !model.startsWith(CLAUDE_PREFIX) && (await env.IV_KV.get('free:exhausted'))) break;
    try {
      const data = await attempt(model, freeEnd, 2);
      if (data) return { ok: true, data, model, usage };
      errors.push(`${model}: invalid json, wrong language or out of time`);
    } catch (e) {
      if (e instanceof HttpError) await markModel(env, model, e.status);
      // A declined Claude reply is still billed: count it.
      const billed = (e as { usage?: Usage }).usage;
      if (billed) {
        usage.calls += billed.calls;
        usage.tokensIn += billed.tokensIn;
        usage.tokensOut += billed.tokensOut;
        usage.costUsd = Math.round((usage.costUsd + billed.costUsd) * 1e9) / 1e9;
      }
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
      if (data) return { ok: true, data, model, usage };
      errors.push(`${model}: invalid json, wrong language or out of time`);
    } catch (e) {
      if (e instanceof HttpError) await markModel(env, model, e.status);
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  // Model names and error kinds only: never request or response content.
  console.warn(`llm fallback after ${Date.now() - start}ms: ${errors.join(' | ') || 'no models available'}`);
  return { ok: false, fallback: true, errors, usage };
}

/** Monthly cap on paid calls (best-effort KV counter). */
async function takePaidCall(env: Env): Promise<boolean> {
  const key = `paid:calls:${new Date().toISOString().slice(0, 7)}`;
  const n = Number((await env.IV_KV.get(key)) ?? 0);
  if (n >= intVar(env.PAID_MONTHLY_CALLS, 3000)) return false;
  await env.IV_KV.put(key, String(n + 1), { expirationTtl: 40 * 86400 });
  return true;
}
