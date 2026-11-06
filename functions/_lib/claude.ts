import Anthropic from '@anthropic-ai/sdk';
import type { Env } from './env';
import type { ChatMessage } from './llm';

/** Models called through the Claude API are written "claude:<model>" in the provider chain. */
export const CLAUDE_PREFIX = 'claude:';
export const DEFAULT_CLAUDE_MODELS = 'claude-sonnet-5-5';
/** USD per 1M tokens: input, output, cache read. Override with CLAUDE_PRICES "model:in/out,...". */
const CLAUDE_PRICES: Record<string, [number, number]> = { 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5], 'claude-opus-5-5': [4, 20] };

/** A reply the router should treat as a failed attempt and move on (a decline, or no text to parse). */
export class ClaudeDecline extends Error {}

export function claudeCost(env: Env, model: string, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number {
  const custom = Object.fromEntries(
    (env.CLAUDE_PRICES ?? '').split(',').map((x) => x.trim().match(/^(.+):([\d.]+)\/([\d.]+)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], [Number(m[2]), Number(m[3])] as [number, number]]),
  );
  const [pin, pout] = custom[model] ?? CLAUDE_PRICES[model] ?? [0, 0];
  // Cache reads cost a tenth of input, cache writes 1.25x; our prompts are not cached, so both are usually zero.
  const input = u.input_tokens + (u.cache_read_input_tokens ?? 0) * 0.1 + (u.cache_creation_input_tokens ?? 0) * 1.25;
  return (input * pin + u.output_tokens * pout) / 1e6;
}

/**
 * Errors that will not go away by trying again in a minute: no credits left (402 billing_error, or a 400 that says
 * the credit balance is too low) or a key that is invalid, expired or not allowed (401/403).
 */
export function offReason(status: number | undefined, type: string | null | undefined, message: string): 'billing' | 'auth' | null {
  if (status === 402 || type === 'billing_error' || /credit balance|billing|spend limit/i.test(message)) return 'billing';
  if (status === 401 || status === 403 || type === 'authentication_error' || type === 'permission_error') return 'auth';
  return null;
}

export const CLAUDE_OFF_KEY = 'claude:off';
/** How long Claude is skipped after such an error: checked again hourly, so topping up credits brings it back by itself. */
export const CLAUDE_OFF_SECONDS = 3600;

async function switchOff(env: Env, reason: 'billing' | 'auth', status: number | undefined): Promise<void> {
  const until = new Date(Date.now() + CLAUDE_OFF_SECONDS * 1000).toISOString();
  await env.IV_KV.put(CLAUDE_OFF_KEY, JSON.stringify({ reason, status, until }), { expirationTtl: CLAUDE_OFF_SECONDS });
  console.warn(`claude switched off for ${CLAUDE_OFF_SECONDS}s: ${reason} (HTTP ${status}); Gemini serves meanwhile`);
}

/** Why Claude is skipped right now, if it is (for the operator view). */
export async function claudeOff(env: Env): Promise<{ reason: string; status?: number; until: string } | null> {
  const v = await env.IV_KV.get(CLAUDE_OFF_KEY);
  return v ? JSON.parse(v) : null;
}

const DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/;

/** Our OpenAI-style messages → the Messages API: system text apart, image data URLs as base64 image blocks. */
export function toClaude(messages: ChatMessage[]): { system: string; messages: Anthropic.MessageParam[] } {
  const system = messages.filter((m) => m.role === 'system').map((m) => (typeof m.content === 'string' ? m.content : m.content.map((p) => (p.type === 'text' ? p.text : '')).join('\n'))).join('\n\n');
  const out: Anthropic.MessageParam[] = messages
    .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
    .map((m) => ({
      role: m.role,
      content:
        typeof m.content === 'string'
          ? m.content
          : m.content.flatMap((p): Anthropic.ContentBlockParam[] => {
              if (p.type === 'text') return [{ type: 'text', text: p.text }];
              const d = p.image_url.url.match(DATA_URL);
              // Images go before the text that asks about them, as the API recommends.
              return d ? [{ type: 'image', source: { type: 'base64', media_type: d[1] as 'image/png', data: d[2] } }] : [];
            }).sort((a, b) => (a.type === 'image' ? -1 : 0) - (b.type === 'image' ? -1 : 0)),
    }));
  return { system, messages: out };
}

/**
 * One Messages API call. Thinking is at its lowest setting (between_tools, effort low): every call here is a
 * one-shot JSON answer a candidate is waiting for, so time and tokens go to the answer. Sampling parameters are
 * left at their defaults (Claude Sonnet 5.5 rejects others). The SDK does not retry: the provider chain does.
 */
export async function claudeChat(env: Env, model: string, messages: ChatMessage[], timeoutMs: number, fetchFn: typeof fetch, maxTokens = 4000) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, fetch: fetchFn, maxRetries: 0, timeout: timeoutMs });
  const { system, messages: msgs } = toClaude(messages);
  let res: Anthropic.Message;
  try {
    res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: msgs,
      thinking: { type: 'between_tools' },
      output_config: { effort: 'low' },
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const off = offReason(e.status, e.type, e.message);
      if (off) await switchOff(env, off, e.status);
      throw Object.assign(new Error(`${CLAUDE_PREFIX}${model}: HTTP ${e.status ?? 0}${off ? ` (${off})` : ''}`), { status: e.status ?? 0 });
    }
    throw e;
  }
  const usage = { calls: 1, tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens, costUsd: claudeCost(env, model, res.usage) };
  // A decline is billed like any reply but has nothing to use: the chain moves on to the next provider.
  if (res.stop_reason === 'refusal') throw Object.assign(new ClaudeDecline(`${CLAUDE_PREFIX}${model}: refusal ${res.stop_details?.category ?? ''}`.trim()), { usage });
  const content = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return { content, usage };
}
