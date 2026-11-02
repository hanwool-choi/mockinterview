import type { Chunk, InterviewerConfig, Lang, Question, Score, Stage } from './schema';

export type SessionRequest = { turnstileToken?: string; deviceToken?: string };
export type SessionResponse = { sid: string; deviceToken: string; remaining: number };
export type QuotaReason = 'global' | 'device';

export type PlanRequest = {
  sid: string;
  lang: Lang;
  company: string;
  role: string;
  career: 'new' | 'exp';
  years?: number;
  interviewers: InterviewerConfig[];
  chunks: Chunk[];
};

export type ScoreRequest = {
  sid: string;
  lang: Lang;
  question: Question;
  answer: string;
  thread: { q: string; a: string }[];
  evidence: Chunk[];
  history: string[];
  interviewers: InterviewerConfig[];
  followUpsUsed: number;
  followUpLimit: number;
  /** Already asked in this interview, and still planned: the follow-up must not repeat either. */
  asked?: string[];
  upcoming?: string[];
};

export type ReportRequest = {
  sid: string;
  lang: Lang;
  company: string;
  role: string;
  interviewers: { id: string; displayName: string; title: string }[];
  items: { questionId: string; stage: Stage; score: Score }[];
};

export type ApiResult<T> = { ok: true; data: T; model: string } | { ok: false; fallback: true };

/** Byte limits (UTF-8: Hangul is 3 bytes/char). docBytes leaves headroom under planBytes for JSON overhead. */
export const LIMITS = { planBytes: 120_000, scoreBytes: 48_000, reportBytes: 64_000, ocrBytes: 2_600_000, docBytes: 100_000 } as const;
/** score: up to 12 planned questions + 6 follow-ups (MAX_FOLLOWUPS_TOTAL) + retries, with room to spare. */
export const SESSION_CAPS = { plan: 1, score: 24, report: 1 } as const;
