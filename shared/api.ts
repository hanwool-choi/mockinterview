import type { Chunk, InterviewerConfig, Lang, Question, Score, Stage } from './schema';

export type InterviewLength = 'quick' | 'full';
export type SessionRequest = { turnstileToken?: string; deviceToken?: string; length?: InterviewLength };
/** ai: whether AI answers right now ('paused' = operator kill switch, 'budget' = today's AI budget is spent). */
export type AiState = 'on' | 'paused' | 'budget';
export type SessionResponse = { sid: string; deviceToken: string; ai: AiState };
/** Why the server refused an AI call. */
export type QuotaReason = 'paused' | 'budget' | 'session' | 'rate';

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
  /** Key lines of the job posting (duties, requirements, preferred), extracted in the browser. */
  jdFacts?: string;
  /** The next planned question: the same call rewrites it from the answers so far (one AI call per turn). */
  next?: { stage: Stage; askedBy: string; draft: string; intent: string };
};

export type ReportRequest = {
  sid: string;
  lang: Lang;
  company: string;
  role: string;
  interviewers: { id: string; displayName: string; title: string }[];
  items: { questionId: string; stage: Stage; score: Score }[];
  /** Quick interview: a short summary evaluation instead of the detailed report. */
  brief?: boolean;
};

export type ApiResult<T> = { ok: true; data: T; model: string } | { ok: false; fallback: true };

/** Byte limits (UTF-8: Hangul is 3 bytes/char). */
export const LIMITS = { scoreBytes: 48_000, reportBytes: 64_000, ocrBytes: 2_600_000, docBytes: 100_000 } as const;
/** score: up to 12 planned questions + 6 follow-ups (MAX_FOLLOWUPS_TOTAL) + retries, with room to spare. */
export const SESSION_CAPS = { score: 24, report: 1 } as const;
