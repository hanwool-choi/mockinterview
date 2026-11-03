import type { ApiResult, InterviewLength, QuotaReason, ReportRequest, ScoreRequest, SessionResponse } from '../../shared/api';
import type { Report, Score } from '../../shared/schema';

export type AppConfig = { turnstileSiteKey: string; fake: boolean; donate?: { kakao: string; fairy: string } };

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

/** Why the server last refused an AI call ('paused' = operator stop, 'budget' = today's or this session's AI budget is spent). */
export let lastRefusal: 'paused' | 'budget' | null = null;
const unwrap = <T>(r: { status: number; body: ApiResult<T> | null }): T | null => {
  const reason = (r.body as { reason?: string } | null)?.reason;
  if ((r.status === 429 || r.status === 503) && (reason === 'paused' || reason === 'budget')) lastRefusal = reason;
  return r.status === 200 && r.body?.ok ? r.body.data : null;
};

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
  async session(turnstileToken?: string, length: InterviewLength = 'full'): Promise<{ ok: true; data: SessionResponse } | { ok: false; reason: QuotaReason | 'error' }> {
    const deviceToken = localStorage.getItem(DEVICE_KEY) ?? undefined;
    const r = await post<SessionResponse & { reason?: QuotaReason }>('/api/session', { turnstileToken, deviceToken, length }, 15000);
    if (r.status === 200 && r.body?.sid) {
      localStorage.setItem(DEVICE_KEY, r.body.deviceToken);
      return { ok: true, data: r.body };
    }
    return { ok: false, reason: r.status === 429 && r.body?.reason ? r.body.reason : 'error' };
  },
  score: async (req: ScoreRequest, timeoutMs = 95_000) => unwrap(await post<ApiResult<Score>>('/api/score', req, timeoutMs)),
  /** Reads text from one image with the server's vision model. */
  async ocr(image: string, kind: 'jd' | 'resume' | 'portfolio', lang: 'ko' | 'en'): Promise<{ ok: true; text: string } | { ok: false; reason: 'quota' | 'error' }> {
    const r = await post<ApiResult<{ text: string }>>('/api/ocr', { image, kind, lang }, 100_000);
    if (r.status === 429) return { ok: false, reason: 'quota' };
    const d = unwrap(r);
    return d?.text ? { ok: true, text: d.text } : { ok: false, reason: 'error' };
  },
  report: async (req: ReportRequest) => unwrap(await post<ApiResult<Report>>('/api/report', req, 130_000)),
  track(name: 'start' | 'complete' | 'drop' | 'rating' | 'fallback' | 'support_click', label = '', value = 0) {
    try {
      const body = JSON.stringify({ name, label, value });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }));
      else void fetch('/api/event', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
    } catch {
      /* metrics are best-effort */
    }
  },
};
