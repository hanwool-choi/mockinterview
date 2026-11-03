export type Env = {
  IV_KV: KVNamespace;
  OPENROUTER_API_KEY?: string;
  DEVICE_SECRET?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITEKEY?: string;
  /** Where the 'support the token cost' button points (https only). Empty hides the button. */
  DONATE_URL?: string;
  DAILY_GLOBAL_INTERVIEWS?: string;
  DAILY_DEVICE_INTERVIEWS?: string;
  DAILY_IP_INTERVIEWS?: string;
  DAILY_OCR_PER_IP?: string;
  DAILY_OCR_GLOBAL?: string;
  PREFERRED_MODELS?: string;
  PAID_OVERFLOW?: string;
  PAID_MODEL?: string;
  /** 'on' lets models think before answering (much slower); off by default. */
  LLM_REASONING?: string;
  PAID_MONTHLY_CALLS?: string;
  ALLOWED_ORIGINS?: string;
  EVENTS?: AnalyticsEngineDataset;
};

export const isFake = (env: Env) => !env.OPENROUTER_API_KEY;
export const intVar = (v: string | undefined, d: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};
