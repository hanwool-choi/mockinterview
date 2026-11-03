import type { InterviewerConfig, Plan, Question, Score } from '../../shared/schema';
import { followUpLimit } from './assign';

export type Phase = 'LOBBY' | 'GREETING' | 'ICEBREAK' | 'ASK' | 'ANSWERING' | 'SCORING' | 'REACT' | 'FEEDBACK' | 'TRANSITION' | 'REVERSE_QA' | 'CLOSING' | 'REPORT' | 'PAUSED';
export type Mode = 'practice' | 'real';

export type AnswerItem = { questionId: string; stage: Question['stage']; asked: string; askedBy: string; answer: string; score?: Score; skipped?: boolean; followUp: boolean };

export type InterviewState = {
  phase: Phase;
  prevPhase?: Phase;
  mode: Mode;
  plan: Plan;
  interviewers: InterviewerConfig[];
  qIndex: number;
  followUpsUsed: number;
  retriesUsed: number;
  pendingFollowUp: { text: string; askedBy: string } | null;
  thread: { q: string; a: string }[];
  items: AnswerItem[];
};

export type InterviewEvent =
  | { type: 'START' }
  | { type: 'NEXT' }
  | { type: 'ANSWER_SUBMIT'; text: string }
  | { type: 'SKIP' }
  | { type: 'RETRY' }
  | { type: 'SCORE_READY'; score: Score }
  | { type: 'SCORE_FAILED'; score: Score }
  | { type: 'SCORE_LATE'; itemIndex: number; score: Score }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'END_EARLY' }
  | { type: 'LOAD'; state: InterviewState }
  /** The turn call rewrote an upcoming question for this candidate. */
  | { type: 'REWRITE'; index: number; text: string; intent: string };

export const initialState = (plan: Plan, mode: Mode, interviewers: InterviewerConfig[]): InterviewState => ({
  phase: 'LOBBY', mode, plan, interviewers, qIndex: 0, followUpsUsed: 0, retriesUsed: 0, pendingFollowUp: null, thread: [], items: [],
});

export const currentQuestion = (s: InterviewState): Question | undefined => s.plan.questions[s.qIndex];
export const currentAsker = (s: InterviewState): string => s.pendingFollowUp?.askedBy || currentQuestion(s)?.askedBy || s.interviewers[0]?.id;
export const currentText = (s: InterviewState): string => s.pendingFollowUp?.text ?? currentQuestion(s)?.text ?? '';

/** Follow-ups across the whole interview: enough pressure without doubling its length (a real run had 15 for 11 questions). */
export const MAX_FOLLOWUPS_TOTAL = 6;
export const followUpsLeft = (s: InterviewState): number => Math.max(0, MAX_FOLLOWUPS_TOTAL - s.items.filter((i) => i.followUp).length);

function limitFor(s: InterviewState): number {
  const q = currentQuestion(s);
  const iv = s.interviewers.find((i) => i.id === q?.askedBy) ?? s.interviewers[0];
  return iv ? followUpLimit(iv.personality) : 1;
}

const answerPhase = (s: InterviewState): Phase => (currentQuestion(s)?.stage === 'reverse' ? 'REVERSE_QA' : 'ANSWERING');

function afterReact(s: InterviewState): InterviewState {
  const last = s.items[s.items.length - 1];
  const fu = last?.score?.followUp;
  if (fu?.needed && fu.text && s.followUpsUsed < limitFor(s) && followUpsLeft(s) > 0) {
    return { ...s, phase: 'ASK', followUpsUsed: s.followUpsUsed + 1, pendingFollowUp: { text: fu.text, askedBy: fu.askedBy || currentQuestion(s)!.askedBy } };
  }
  return { ...s, phase: 'TRANSITION' };
}

function attach(s: InterviewState, score: Score): InterviewState {
  const items = s.items.slice();
  items[items.length - 1] = { ...items[items.length - 1], score };
  return { ...s, items, phase: 'REACT' };
}

export function reduce(s: InterviewState, e: InterviewEvent): InterviewState {
  if (e.type === 'LOAD') return e.state;
  if (e.type === 'REWRITE') {
    // Only questions not yet asked may change.
    if (e.index <= s.qIndex || e.index >= s.plan.questions.length || !e.text.trim()) return s;
    const questions = s.plan.questions.map((q, i) => (i === e.index ? { ...q, text: e.text.trim(), intent: e.intent || q.intent } : q));
    return { ...s, plan: { ...s.plan, questions } };
  }
  if (e.type === 'END_EARLY') return s.phase === 'REPORT' ? s : { ...s, phase: 'REPORT' };
  if (e.type === 'PAUSE') return s.phase === 'PAUSED' || s.phase === 'REPORT' ? s : { ...s, phase: 'PAUSED', prevPhase: s.phase };
  if (s.phase === 'PAUSED' && s.prevPhase === 'SCORING' && (e.type === 'SCORE_READY' || e.type === 'SCORE_FAILED')) {
    return { ...attach(s, e.score), phase: 'PAUSED', prevPhase: 'REACT' };
  }
  if (e.type === 'RESUME') return s.phase === 'PAUSED' ? { ...s, phase: s.prevPhase ?? 'ASK', prevPhase: undefined } : s;
  if (e.type === 'SCORE_LATE') {
    if (!s.items[e.itemIndex]) return s;
    const items = s.items.slice();
    items[e.itemIndex] = { ...items[e.itemIndex], score: e.score };
    return { ...s, items };
  }
  switch (s.phase) {
    case 'LOBBY':
      return e.type === 'START' ? { ...s, phase: 'GREETING' } : s;
    case 'GREETING':
      return e.type === 'NEXT' ? { ...s, phase: 'ICEBREAK' } : s;
    case 'ICEBREAK':
      return e.type === 'NEXT' ? { ...s, phase: s.plan.questions.length ? 'ASK' : 'CLOSING' } : s;
    case 'ASK':
      return e.type === 'NEXT' ? { ...s, phase: answerPhase(s) } : s;
    case 'ANSWERING':
    case 'REVERSE_QA': {
      const q = currentQuestion(s)!;
      if (e.type === 'ANSWER_SUBMIT') {
        const asked = currentText(s);
        const item: AnswerItem = { questionId: q.id, stage: q.stage, asked, askedBy: currentAsker(s), answer: e.text, followUp: !!s.pendingFollowUp };
        return { ...s, phase: 'SCORING', items: [...s.items, item], thread: [...s.thread, { q: asked, a: e.text }] };
      }
      if (e.type === 'SKIP') {
        const item: AnswerItem = { questionId: q.id, stage: q.stage, asked: currentText(s), askedBy: currentAsker(s), answer: '', skipped: true, followUp: !!s.pendingFollowUp };
        return { ...s, phase: 'TRANSITION', items: [...s.items, item] };
      }
      return s;
    }
    case 'SCORING':
      return e.type === 'SCORE_READY' || e.type === 'SCORE_FAILED' ? attach(s, e.score) : s;
    case 'REACT':
      if (e.type !== 'NEXT') return s;
      return s.mode === 'practice' ? { ...s, phase: 'FEEDBACK' } : afterReact(s);
    case 'FEEDBACK':
      if (e.type === 'NEXT') return afterReact(s);
      if (e.type === 'RETRY' && s.retriesUsed < 1) {
        return { ...s, phase: answerPhase(s), retriesUsed: s.retriesUsed + 1, items: s.items.slice(0, -1), thread: s.thread.slice(0, -1) };
      }
      return s;
    case 'TRANSITION': {
      if (e.type !== 'NEXT') return s;
      const next = s.qIndex + 1;
      const base = { ...s, followUpsUsed: 0, retriesUsed: 0, pendingFollowUp: null, thread: [] };
      return next >= s.plan.questions.length ? { ...base, phase: 'CLOSING' } : { ...base, qIndex: next, phase: 'ASK' };
    }
    case 'CLOSING':
      return e.type === 'NEXT' ? { ...s, phase: 'REPORT' } : s;
    default:
      return s;
  }
}

export const estimateSpeechSec = (text: string, lang: 'ko' | 'en') =>
  lang === 'ko' ? Math.round((text.replace(/\s/g, '').length / 350) * 60) : Math.round((text.trim().split(/\s+/).filter(Boolean).length / 140) * 60);

export const STAGE_TARGET_SEC: Record<Question['stage'], [number, number]> = {
  intro: [60, 90], motivation: [40, 90], experience: [60, 120], competency: [60, 120], company: [40, 90], situational: [60, 120], reverse: [15, 60], closing: [15, 45],
};
