import type { ZodType } from 'zod';
import { type Env, isFake } from './env';
import { getFreeModels } from './models';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
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

class HttpError extends Error {}

async function chatOnce(env: Env, model: string, messages: ChatMessage[], timeoutMs: number, fetchFn: typeof fetch): Promise<string> {
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
      body: JSON.stringify({ model, messages, temperature: 0.6 }),
    });
    if (!res.ok) throw new HttpError(`${model}: HTTP ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

export async function callJson<T>(
  env: Env,
  opts: { messages: ChatMessage[]; schema: ZodType<T>; timeoutMs: number; deadlineMs?: number; maxModels?: number; fetchFn?: typeof fetch; fake: () => T },
): Promise<CallResult<T>> {
  if (isFake(env)) return { ok: true, data: opts.fake(), model: 'fake' };
  const fetchFn = opts.fetchFn ?? fetch;
  const models = (await getFreeModels(env, fetchFn)).slice(0, opts.maxModels ?? 3);
  const paid = env.PAID_OVERFLOW === 'on' && env.PAID_MODEL ? env.PAID_MODEL : null;
  if (paid) models.push(paid);
  const errors: string[] = [];
  // One overall deadline (kept below the client's timeout) so the fallback chain actually gets a turn.
  const end = Date.now() + (opts.deadlineMs ?? opts.timeoutMs * models.length);
  for (const model of models) {
    try {
      let messages = opts.messages;
      const attempts = model === paid ? 1 : 2;
      for (let attempt = 0; attempt < attempts; attempt++) {
        const left = end - Date.now();
        if (left <= 0) break;
        const raw = await chatOnce(env, model, messages, Math.min(opts.timeoutMs, left), fetchFn);
        const parsed = opts.schema.safeParse(parseModelJson(raw));
        if (parsed.success) return { ok: true, data: parsed.data, model };
        messages = [
          ...opts.messages,
          { role: 'assistant', content: raw.slice(0, 4000) },
          { role: 'user', content: 'The previous output was not valid JSON for the required schema. Output ONLY the corrected JSON object, nothing else.' },
        ];
      }
      errors.push(`${model}: invalid json or out of time`);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
    if (Date.now() >= end) break;
  }
  return { ok: false, fallback: true, errors };
}
