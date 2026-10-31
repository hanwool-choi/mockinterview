import type { ApiResult, PlanRequest, QuotaReason, ReportRequest, ScoreRequest, SessionResponse } from '../../shared/api';
import type { Plan, Report, Score } from '../../shared/schema';

export type AppConfig = { turnstileSiteKey: string; fake: boolean };

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<{ status: number; body: T | null }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    const j = (await r.json().catch(() => null)) as T | null;
    return { status: r.status, body: j };
  } catch {
    return { status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

const unwrap = <T>(r: { status: number; body: ApiResult<T> | null }): T | null => (r.status === 200 && r.body?.ok ? r.body.data : null);

const DEVICE_KEY = 'iv:device';

export const api = {
  async config(): Promise<AppConfig> {
    try {
      const r = await fetch('/api/config');
      return (await r.json()) as AppConfig;
    } catch {
      return { turnstileSiteKey: '', fake: true };
    }
  },
  async session(turnstileToken?: string): Promise<{ ok: true; data: SessionResponse } | { ok: false; reason: QuotaReason | 'error' }> {
    const deviceToken = localStorage.getItem(DEVICE_KEY) ?? undefined;
    const r = await post<SessionResponse & { reason?: QuotaReason }>('/api/session', { turnstileToken, deviceToken }, 15000);
    if (r.status === 200 && r.body?.sid) {
      localStorage.setItem(DEVICE_KEY, r.body.deviceToken);
      return { ok: true, data: r.body };
    }
    return { ok: false, reason: r.status === 429 && r.body?.reason ? r.body.reason : 'error' };
  },
  plan: async (req: PlanRequest) => unwrap(await post<ApiResult<Plan>>('/api/plan', req, 100_000)),
  score: async (req: ScoreRequest, timeoutMs = 35_000) => unwrap(await post<ApiResult<Score>>('/api/score', req, timeoutMs)),
  report: async (req: ReportRequest) => unwrap(await post<ApiResult<Report>>('/api/report', req, 70_000)),
  track(name: 'start' | 'complete' | 'drop' | 'rating' | 'fallback', label = '', value = 0) {
    try {
      const body = JSON.stringify({ name, label, value });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }));
      else void fetch('/api/event', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
    } catch {
      /* metrics are best-effort */
    }
  },
};
