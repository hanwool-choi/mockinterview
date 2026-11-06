export type Env = {
  IV_KV: KVNamespace;
  OPENROUTER_API_KEY?: string;
  /** Google AI Studio key: Gemini models are called directly and tried first. */
  /** Claude API key (secret; a service account key). Claude models are tried first when it is set. */
  ANTHROPIC_API_KEY?: string;
  /** Comma list of Claude model ids, tried in order (default: claude-sonnet-5-5). */
  CLAUDE_MODELS?: string;
  /** Override Claude prices, "model:in/out,..." in USD per 1M tokens. */
  CLAUDE_PRICES?: string;
  GEMINI_API_KEY?: string;
  /** Comma list of Gemini model ids, tried in order (default: gemini-2.5-flash-lite, gemini-3.5-flash-lite). */
  GEMINI_MODELS?: string;
  /** 'free' (default, recorded at $0) or 'paid' (priced from GEMINI_PRICES). */
  GEMINI_TIER?: string;
  GEMINI_PRICES?: string;
  DEVICE_SECRET?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITEKEY?: string;
  /** Support buttons: KakaoPay transfer-code link (https://qr.kakaopay.com/…) and Fairy project page (https://fairy.hada.io/…). Empty hides a button. */
  KAKAOPAY_URL?: string;
  FAIRY_URL?: string;
  DAILY_OCR_PER_IP?: string;
  DAILY_OCR_GLOBAL?: string;
  /** Daily caps on resume structuring (per IP / everyone); defaults 30 / 1500. */
  DAILY_STRUCTURE_PER_IP?: string;
  DAILY_STRUCTURE_GLOBAL?: string;
  PREFERRED_MODELS?: string;
  PAID_OVERFLOW?: string;
  PAID_MODEL?: string;
  /** 'on' lets models think before answering (much slower); off by default. */
  LLM_REASONING?: string;
  PAID_MONTHLY_CALLS?: string;
  ALLOWED_ORIGINS?: string;
  /** Cost control (see functions/_lib/budget.ts). 'on' pauses every AI call; KV key ai:kill does the same without a redeploy. */
  AI_KILL_SWITCH?: string;
  DAILY_BUDGET_USD?: string;
  SESSION_BUDGET_QUICK_USD?: string;
  SESSION_BUDGET_FULL_USD?: string;
  /** Bearer token for GET/POST /api/usage (ledger and kill switch). */
  ADMIN_TOKEN?: string;
  /** Minimum gap between AI calls of one session (ms); tests lower it. */
  MIN_CALL_GAP_MS?: string;
  EVENTS?: AnalyticsEngineDataset;
};

/** Demo mode: no AI provider key at all. */
export const isFake = (env: Env) => !env.OPENROUTER_API_KEY && !env.GEMINI_API_KEY && !env.ANTHROPIC_API_KEY;
export const intVar = (v: string | undefined, d: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};
