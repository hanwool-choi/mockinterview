import { SESSION_CAPS } from '../../shared/api';
import type { Env } from './env';
import type { Usage } from './llm';
import { kstDay } from './security';

/**
 * Cost control for every AI call.
 *
 * - gate(): kill switch, session caps, a per-session request gap, per-session and daily dollar budgets.
 * - charge(): the usage ledger. Costs are integer micro-dollars in KV:
 *     sess:<sid>               session record (counts, cost, tokens) — rewritten on every gated call anyway
 *     usage:d:<day>            daily totals, by call kind and by model, plus session count
 *     usage:u:<day>:<device>   per anonymous device per day
 *   KV is not atomic: under heavy concurrency totals are approximate, never a hard ceiling.
 */

export type Length = 'quick' | 'full';
export type CallKind = keyof typeof SESSION_CAPS;
type Counts = Record<CallKind, number>;
export type SessionRecord = { deviceId: string; length: Length; counts: Counts; costMicro: number; tokensIn: number; tokensOut: number; calls: number; lastAt: number };
type Bucket = { calls: number; costMicro: number };
type DayRecord = { calls: number; tokensIn: number; tokensOut: number; costMicro: number; sessions: number; kinds: Record<string, Bucket>; models: Record<string, Bucket> };

/** Defaults when the env vars are unset; wrangler.toml sets the live values. */
export const SESSION_BUDGET_USD: Record<Length, number> = { quick: 0.02, full: 0.1 };
export const DAILY_BUDGET_USD = 2;
/** Minimum gap between two AI calls of one session (report is exempt: it follows the last answer). */
export const MIN_GAP_MS = 2_000;
const SIX_HOURS = 6 * 3600;
const TWO_DAYS = 2 * 86400;
const micro = (usd: number) => Math.round(usd * 1e6);
const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const sessionKey = (sid: string) => `sess:${sid}`;
const dayKey = (day: string) => `usage:d:${day}`;
const deviceKey = (day: string, device: string) => `usage:u:${day}:${device}`;
const emptyDay = (): DayRecord => ({ calls: 0, tokensIn: 0, tokensOut: 0, costMicro: 0, sessions: 0, kinds: {}, models: {} });

export async function newSession(env: Env, sid: string, deviceId: string, length: Length): Promise<void> {
  const rec: SessionRecord = { deviceId, length, counts: Object.fromEntries(Object.keys(SESSION_CAPS).map((k) => [k, 0])) as Counts, costMicro: 0, tokensIn: 0, tokensOut: 0, calls: 0, lastAt: 0 };
  await env.IV_KV.put(sessionKey(sid), JSON.stringify(rec), { expirationTtl: SIX_HOURS });
  const day = kstDay();
  const d = ((await env.IV_KV.get(dayKey(day), 'json')) as DayRecord | null) ?? emptyDay();
  d.sessions++;
  await env.IV_KV.put(dayKey(day), JSON.stringify(d), { expirationTtl: 40 * 86400 });
}

export async function paused(env: Env): Promise<boolean> {
  return env.AI_KILL_SWITCH === 'on' || !!(await env.IV_KV.get('ai:kill'));
}

export async function dailyLeft(env: Env, day = kstDay()): Promise<number> {
  const d = (await env.IV_KV.get(dayKey(day), 'json')) as DayRecord | null;
  return num(env.DAILY_BUDGET_USD, DAILY_BUDGET_USD) - (d?.costMicro ?? 0) / 1e6;
}

export type GateResult = { ok: true; session: SessionRecord } | { ok: false; status: number; reason: 'paused' | 'budget' | 'session' | 'rate' | 'unknown' };

export async function gate(env: Env, sid: string | undefined, kind: CallKind, at: { day?: string; now?: number } = {}): Promise<GateResult> {
  const now = at.now ?? Date.now();
  if (await paused(env)) return { ok: false, status: 503, reason: 'paused' };
  if (!sid || typeof sid !== 'string' || sid.length > 64) return { ok: false, status: 401, reason: 'unknown' };
  const s = (await env.IV_KV.get(sessionKey(sid), 'json')) as SessionRecord | null;
  if (!s) return { ok: false, status: 401, reason: 'unknown' };
  if ((s.counts[kind] ?? 0) >= SESSION_CAPS[kind]) return { ok: false, status: 429, reason: 'session' };
  if (kind !== 'report' && s.lastAt && now - s.lastAt < num(env.MIN_CALL_GAP_MS, MIN_GAP_MS)) return { ok: false, status: 429, reason: 'rate' };
  const cap = s.length === 'quick' ? num(env.SESSION_BUDGET_QUICK_USD, SESSION_BUDGET_USD.quick) : num(env.SESSION_BUDGET_FULL_USD, SESSION_BUDGET_USD.full);
  if (s.costMicro >= micro(cap)) return { ok: false, status: 429, reason: 'budget' };
  if ((await dailyLeft(env, at.day)) <= 0) return { ok: false, status: 429, reason: 'budget' };
  s.counts[kind] = (s.counts[kind] ?? 0) + 1;
  s.lastAt = now;
  await env.IV_KV.put(sessionKey(sid), JSON.stringify(s), { expirationTtl: SIX_HOURS });
  return { ok: true, session: s };
}

const add = (b: Bucket | undefined, calls: number, cost: number): Bucket => ({ calls: (b?.calls ?? 0) + calls, costMicro: (b?.costMicro ?? 0) + cost });

/** Record what a call actually cost. Free models cost 0 but still count calls and tokens. */
export async function charge(env: Env, sid: string | null, kind: string, model: string, usage: Usage, at: { day?: string } = {}): Promise<void> {
  if (!usage.calls) return;
  const day = at.day ?? kstDay();
  const cost = micro(usage.costUsd);
  let device = 'anon';
  if (sid) {
    const s = (await env.IV_KV.get(sessionKey(sid), 'json')) as SessionRecord | null;
    if (s) {
      device = s.deviceId;
      s.costMicro += cost;
      s.tokensIn += usage.tokensIn;
      s.tokensOut += usage.tokensOut;
      s.calls += usage.calls;
      await env.IV_KV.put(sessionKey(sid), JSON.stringify(s), { expirationTtl: SIX_HOURS });
    }
  }
  const d = ((await env.IV_KV.get(dayKey(day), 'json')) as DayRecord | null) ?? emptyDay();
  d.calls += usage.calls;
  d.tokensIn += usage.tokensIn;
  d.tokensOut += usage.tokensOut;
  d.costMicro += cost;
  d.kinds[kind] = add(d.kinds[kind], usage.calls, cost);
  d.models[model] = add(d.models[model], usage.calls, cost);
  await env.IV_KV.put(dayKey(day), JSON.stringify(d), { expirationTtl: 40 * 86400 });
  const u = ((await env.IV_KV.get(deviceKey(day, device), 'json')) as { calls: number; costMicro: number; tokens: number } | null) ?? { calls: 0, costMicro: 0, tokens: 0 };
  await env.IV_KV.put(deviceKey(day, device), JSON.stringify({ calls: u.calls + usage.calls, costMicro: u.costMicro + cost, tokens: u.tokens + usage.tokensIn + usage.tokensOut }), { expirationTtl: TWO_DAYS });
  // Row-level log for SQL queries when an Analytics Engine dataset is bound (no content, no ids beyond the session).
  env.EVENTS?.writeDataPoint({ blobs: ['llm', kind, model, sid ?? ''], doubles: [usage.calls, usage.tokensIn, usage.tokensOut, usage.costUsd], indexes: [day] });
}

export type DaySummary = { day: string; calls: number; tokensIn: number; tokensOut: number; costUsd: number; sessions: number; budgetUsd: number; kinds: Record<string, { calls: number; costUsd: number }>; models: Record<string, { calls: number; costUsd: number }> };

export async function readDay(env: Env, day = kstDay()): Promise<DaySummary> {
  const d = ((await env.IV_KV.get(dayKey(day), 'json')) as DayRecord | null) ?? emptyDay();
  const conv = (r: Record<string, Bucket>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { calls: v.calls, costUsd: v.costMicro / 1e6 }]));
  return { day, calls: d.calls, tokensIn: d.tokensIn, tokensOut: d.tokensOut, costUsd: d.costMicro / 1e6, sessions: d.sessions, budgetUsd: num(env.DAILY_BUDGET_USD, DAILY_BUDGET_USD), kinds: conv(d.kinds), models: conv(d.models) };
}
