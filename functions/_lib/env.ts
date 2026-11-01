export type Env = {
  IV_KV: KVNamespace;
  OPENROUTER_API_KEY?: string;
  DEVICE_SECRET?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITEKEY?: string;
  DAILY_GLOBAL_INTERVIEWS?: string;
  DAILY_DEVICE_INTERVIEWS?: string;
  DAILY_IP_INTERVIEWS?: string;
  PREFERRED_MODELS?: string;
  PAID_OVERFLOW?: string;
  PAID_MODEL?: string;
  PAID_MONTHLY_CALLS?: string;
  ALLOWED_ORIGINS?: string;
  EVENTS?: AnalyticsEngineDataset;
};

export const isFake = (env: Env) => !env.OPENROUTER_API_KEY;
export const intVar = (v: string | undefined, d: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};
