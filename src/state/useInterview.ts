import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReportRequest, ScoreRequest } from '../../shared/api';
import { LIMITS, SESSION_CAPS } from '../../shared/api';
import type { Chunk, Expression, Plan, Report, Score } from '../../shared/schema';
import { api } from '../api/client';
import { BM25 } from '../docs/bm25';
import { budgetChunks, chunkDoc } from '../docs/chunk';
import { maskPII } from '../docs/mask';
import { mostSenior } from '../engine/assign';
import { followUpLimit } from '../engine/assign';
import { localReport } from '../engine/localReport';
import { localScore } from '../engine/localScore';
import { currentAsker, currentQuestion, currentText, initialState, reduce, type InterviewEvent, type InterviewState } from '../engine/machine';
import { adjustReactions } from '../engine/reactions';
import { buildTemplatePlan, fillMissing } from '../engine/templates';
import { ackFor, dedupeQuestions, sanitizeFollowUp } from '../engine/dialogue';
import { translate } from '../i18n';
import { createTts, voiceProfileFor, type TtsEngine } from '../voice/tts';
import { makeReportRequest, makeScoreRequest } from './requests';
import type { Setup } from './setup';

export type PanelApi = {
  setExpression(id: string, e: Expression): void;
  setSpeaking(id: string | null, on?: boolean): void;
  setAction(id: string, a: 'write' | 'flip' | null): void;
  focus(id: string | null): void;
};
export type Line = { id: number; who: string; text: string; kind: 'q' | 'a' | 'say' | 'system'; questionId?: string; followUp?: boolean };
export type RunStatus = 'planning' | 'running' | 'reporting' | 'done';

const RUN_KEY = 'iv:run';
type Persisted = { sid: string; plan: Plan; state: InterviewState; lines: Line[]; basicPlan: boolean; report: Report | null; icebreakOpen: boolean };

const pickRandom = <T,>(xs: T[], fallback: T): T => (xs.length ? xs[Math.floor(Math.random() * xs.length)] : fallback);

export function buildChunks(setup: Setup): Chunk[] {
  const m = (s: string) => maskPII(s, { lang: setup.lang, name: setup.name }).text;
  const all = [...chunkDoc('jd', m(setup.docs.jd)), ...chunkDoc('resume', m(setup.docs.resume)), ...chunkDoc('portfolio', m(setup.docs.portfolio))];
  return budgetChunks(all, LIMITS.docBytes, setup.docs.jd);
}

export function clearRun() {
  sessionStorage.removeItem(RUN_KEY);
}

export function useInterview(setup: Setup, sid: string, opts: { fast: boolean }) {
  const restored = useMemo(() => {
    try {
      const r = JSON.parse(sessionStorage.getItem(RUN_KEY) ?? 'null') as Persisted | null;
      return r && r.sid === sid ? r : null;
    } catch {
      return null;
    }
  }, [sid]);

  const ivs = setup.interviewers;
  const L = setup.lang;
  const chunks = useMemo(() => buildChunks(setup), [setup]);
  const bm25 = useMemo(() => new BM25(chunks, L), [chunks, L]);
  const template = useMemo(
    () => buildTemplatePlan({ lang: L, company: setup.company, role: setup.role, career: setup.career, interviewers: ivs, chunks }),
    [L, setup.company, setup.role, setup.career, ivs, chunks],
  );

  const [plan, setPlan] = useState<Plan | null>(restored?.plan ?? null);
  const [basicPlan, setBasicPlan] = useState(restored?.basicPlan ?? false);
  const [state, rawDispatch] = useReducer(reduce, restored?.state ?? initialState(template, setup.mode, ivs));
  const [lines, setLines] = useState<Line[]>(restored?.lines ?? []);
  const [speaking, setSpeakingState] = useState<{ id: string; text: string } | null>(null);
  const [report, setReport] = useState<Report | null>(restored?.report ?? null);
  const [status, setStatus] = useState<RunStatus>(restored?.report ? 'done' : restored?.plan ? 'running' : 'planning');
  const [icebreakOpen, setIcebreakOpen] = useState(restored?.icebreakOpen ?? false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const panelRef = useRef<PanelApi | null>(null);
  const ttsRef = useRef<TtsEngine | null>(null);
  const skipRef = useRef<(() => void) | null>(null);
  const handled = useRef<string>('');
  const pending = useRef<Promise<unknown>[]>([]);
  const scoring = useRef<number>(-1);
  const askedRef = useRef<Set<string>>(new Set(restored?.state.items.map((i) => i.asked) ?? []));
  const scoreCalls = useRef(restored?.state.items.filter((i) => !i.skipped).length ?? 0);
  const lineId = useRef(restored?.lines.length ?? 0);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const dispatch = useCallback((e: InterviewEvent) => {
    if (alive.current) rawDispatch(e);
  }, []);

  useEffect(() => {
    if (setup.voice && !ttsRef.current) ttsRef.current = createTts({ prefer: 'os' });
  }, [setup.voice]);

  // persist
  useEffect(() => {
    if (!plan) return;
    const p: Persisted = { sid, plan, state, lines, basicPlan, report, icebreakOpen };
    try {
      sessionStorage.setItem(RUN_KEY, JSON.stringify(p));
    } catch {
      /* quota: ignore */
    }
  }, [sid, plan, state, lines, basicPlan, report, icebreakOpen]);

  const pushLine = useCallback((l: Omit<Line, 'id'>) => {
    setLines((xs) => [...xs, { ...l, id: ++lineId.current }]);
  }, []);

  const say = useCallback(
    async (who: string, text: string, extra: Partial<Line> = {}) => {
      if (!text) return;
      pushLine({ who, text, kind: 'say', ...extra });
      const panel = panelRef.current;
      panel?.focus(who);
      panel?.setSpeaking(who, true);
      setSpeakingState({ id: who, text });
      const iv = ivs.find((i) => i.id === who);
      const waitSkip = new Promise<void>((resolve) => (skipRef.current = resolve));
      const speech = opts.fast
        ? new Promise<void>((r) => setTimeout(r, 120))
        : setup.voice && ttsRef.current && iv
          ? ttsRef.current.speak(text, voiceProfileFor(iv, L))
          : new Promise<void>((r) => setTimeout(r, Math.min(4200, 700 + text.length * (L === 'ko' ? 45 : 22))));
      await Promise.race([speech, waitSkip]);
      ttsRef.current?.cancel();
      skipRef.current = null;
      panel?.setSpeaking(null, false);
      if (alive.current) setSpeakingState(null);
    },
    [ivs, L, opts.fast, pushLine, setup.voice],
  );

  const skipSpeech = useCallback(() => skipRef.current?.(), []);

  // 1) plan
  useEffect(() => {
    if (plan) return;
    let cancelled = false;
    (async () => {
      panelRef.current && ivs.forEach((iv) => panelRef.current?.setAction(iv.id, 'flip'));
      const res = await api.plan({ sid, lang: L, company: setup.company, role: setup.role, career: setup.career, years: setup.years, interviewers: ivs, chunks });
      if (cancelled) return;
      let p: Plan;
      if (res) {
        p = dedupeQuestions(fillMissing(res, template), template);
        const known = new Set(ivs.map((i) => i.id));
        p = { ...p, questions: p.questions.map((q) => (known.has(q.askedBy) ? q : { ...q, askedBy: template.questions.find((t) => t.stage === q.stage)?.askedBy ?? ivs[0].id })) };
        const names = new Map(res.interviewers.map((i) => [i.id, i]));
        p = { ...p, interviewers: template.interviewers.map((t) => ({ ...t, ...(names.get(t.id) ?? {}) })) };
      } else {
        p = template;
        setBasicPlan(true);
        api.track('fallback', 'plan');
      }
      ivs.forEach((iv) => panelRef.current?.setAction(iv.id, null));
      setPlan(p);
      rawDispatch({ type: 'LOAD', state: { ...initialState(p, setup.mode, ivs), phase: 'GREETING' } });
      setStatus('running');
      api.track('start', L);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = state;

  const seniorId = useMemo(() => mostSenior(ivs).id, [ivs]);
  const icebreakerId = useMemo(() => (ivs.find((i) => i.role === 'hr') ?? mostSenior(ivs)).id, [ivs]);
  const nameOf = useCallback((id: string) => plan?.interviewers.find((i) => i.id === id)?.displayName ?? id, [plan]);

  const scoreItem = useCallback(
    async (cur: InterviewState) => {
      const q = currentQuestion(cur)!;
      const itemIndex = cur.items.length - 1;
      if (scoring.current === itemIndex) return; // already in flight (e.g. resumed after pause)
      scoring.current = itemIndex;
      const item = cur.items[itemIndex];
      const ev = new Map<string, Chunk>();
      for (const id of q.evidenceIds) {
        const c = chunks.find((x) => x.id === id);
        if (c) ev.set(c.id, c);
      }
      for (const c of bm25.search(`${q.text} ${q.mustHit.join(' ')} ${item.answer}`, 4)) if (ev.size < 4) ev.set(c.id, c);
      const asker = ivs.find((i) => i.id === q.askedBy) ?? ivs[0];
      const req: ScoreRequest = makeScoreRequest({
        sid, lang: L, question: { ...q, text: item.asked }, answer: item.answer, thread: cur.thread.slice(0, -1),
        evidence: [...ev.values()], history: cur.items.slice(0, -1).map((i) => i.score?.summary ?? '').filter(Boolean).slice(-6),
        interviewers: ivs, followUpsUsed: cur.followUpsUsed, followUpLimit: followUpLimit(asker.personality),
        asked: [...askedRef.current], upcoming: cur.plan.questions.slice(cur.qIndex + 1).map((x) => x.text),
      });
      const upcoming = cur.plan.questions.slice(cur.qIndex + 1).map((x) => x.text);
      const clean = (sc: Score): Score => sanitizeFollowUp(sc, q, askedRef.current, upcoming);
      const local = () => clean(localScore({ ...q, askedBy: item.askedBy }, item.answer, L, [...ev.values()][0]?.text));
      // Respect the per-session cap client-side: past it, score locally without calling the API.
      if (scoreCalls.current >= SESSION_CAPS.score) {
        scoring.current = -1;
        dispatch({ type: 'SCORE_FAILED', score: local() });
        return;
      }
      scoreCalls.current++;
      if (cur.mode === 'practice') {
        const r = await api.score(req);
        if (!r) api.track('fallback', 'score');
        scoring.current = -1;
        dispatch(r ? { type: 'SCORE_READY', score: clean(r) } : { type: 'SCORE_FAILED', score: local() });
        return;
      }
      const remote = api.score(req, 95_000);
      pending.current.push(remote);
      // Free models take 15–35s; wait long enough that a real-mode follow-up can still happen.
      const timer = new Promise<null>((r) => setTimeout(() => r(null), opts.fast ? 4000 : 30_000));
      const first = await Promise.race([remote, timer]);
      scoring.current = -1;
      if (first) {
        dispatch({ type: 'SCORE_READY', score: clean(first) });
        return;
      }
      dispatch({ type: 'SCORE_FAILED', score: { ...local(), followUp: null } });
      const late = await remote;
      if (late) dispatch({ type: 'SCORE_LATE', itemIndex, score: { ...late, followUp: null } });
      else api.track('fallback', 'score');
    },
    [bm25, chunks, dispatch, ivs, L, opts.fast, sid],
  );

  const makeReport = useCallback(
    async (cur: InterviewState, p: Plan) => {
      setStatus('reporting');
      await Promise.race([Promise.allSettled(pending.current), new Promise((r) => setTimeout(r, 15_000))]);
      const latest = stateRef.current;
      const scored = latest.items.filter((i) => i.score && !i.skipped).map((i) => ({ questionId: i.questionId, stage: i.stage, score: i.score as Score }));
      const display = p.interviewers.map((i) => ({ id: i.id, displayName: i.displayName, title: i.title }));
      let r: Report | null = null;
      if (scored.length) {
        const req: ReportRequest = makeReportRequest({ sid, lang: L, company: setup.company, role: setup.role, interviewers: display, items: scored });
        r = await api.report(req);
        if (!r) api.track('fallback', 'report');
      }
      const final = r ?? localReport({ items: scored, questions: p.questions, interviewers: display, lang: L, company: setup.company, role: setup.role });
      if (!alive.current) return;
      setReport(final);
      setStatus('done');
      api.track('complete', cur.mode, final.publicSummary.score);
    },
    [L, setup.company, setup.role, sid],
  );

  // 2) phase side effects
  useEffect(() => {
    if (!plan || status === 'planning') return;
    const cur = s;
    const key = `${cur.phase}:${cur.qIndex}:${cur.followUpsUsed}:${cur.items.length}:${cur.retriesUsed}`;
    if (handled.current === key) return;
    handled.current = key;
    const p = cur.plan;
    (async () => {
      switch (cur.phase) {
        case 'GREETING': {
          const names = p.interviewers.map((i) => `${i.displayName}${i.title ? ' ' + i.title : ''}`).join(L === 'ko' ? ', ' : ', ');
          await say(seniorId, translate(L, 'room.intro', { names }));
          dispatch({ type: 'NEXT' });
          break;
        }
        case 'ICEBREAK': {
          await say(icebreakerId, p.smallTalk.opening[0] ?? (L === 'ko' ? '오시는 길은 괜찮으셨어요?' : 'How was your trip here?'));
          setIcebreakOpen(true);
          break;
        }
        case 'ASK': {
          const q = currentQuestion(cur)!;
          askedRef.current.add(currentText(cur));
          await say(currentAsker(cur), currentText(cur), { kind: 'q', questionId: q.id, followUp: !!cur.pendingFollowUp });
          dispatch({ type: 'NEXT' });
          break;
        }
        case 'SCORING': {
          const asker = currentAsker(cur);
          ivs.forEach((iv) => panelRef.current?.setAction(iv.id, iv.id === asker || Math.random() < 0.5 ? 'write' : null));
          void scoreItem(cur);
          break;
        }
        case 'REACT': {
          ivs.forEach((iv) => panelRef.current?.setAction(iv.id, null));
          const last = cur.items[cur.items.length - 1];
          const sc = last.score!;
          for (const r of adjustReactions(sc.score, ivs, sc.reactions)) setTimeout(() => panelRef.current?.setExpression(r.interviewerId, r.expression), opts.fast ? 0 : r.delayMs);
          // The spoken reaction follows the actual score (the model's line, else a band-matched back-channel).
          const line = sc.reactions.find((r) => r.interviewerId === last.askedBy && r.line)?.line || ackFor(sc.score, L, cur.items.length);
          await say(last.askedBy, line);
          dispatch({ type: 'NEXT' });
          break;
        }
        case 'TRANSITION': {
          const nextQ = p.questions[cur.qIndex + 1];
          if (nextQ && cur.items.length) await say(nextQ.askedBy, pickRandom(p.smallTalk.transitions, L === 'ko' ? '다음 질문 드릴게요.' : 'Next question.'));
          dispatch({ type: 'NEXT' });
          break;
        }
        case 'CLOSING': {
          await say(seniorId, translate(L, 'room.closing'));
          dispatch({ type: 'NEXT' });
          break;
        }
        case 'REPORT': {
          if (!report) await makeReport(cur, p);
          break;
        }
        default:
          break;
      }
    })();
  }, [s, plan, status, say, dispatch, ivs, L, seniorId, icebreakerId, scoreItem, makeReport, report, opts.fast, pushLine]);

  const submit = useCallback(
    (text: string) => {
      const cur = stateRef.current;
      const t = text.trim();
      if (!t) return;
      if (cur.phase === 'ICEBREAK' && icebreakOpen) {
        setIcebreakOpen(false);
        pushLine({ who: 'me', text: t, kind: 'a' });
        void (async () => {
          await say(icebreakerId, plan?.smallTalk.opening[1] ?? pickRandom(plan?.smallTalk.acknowledgements ?? [], L === 'ko' ? '다행이네요.' : 'Good to hear.'));
          dispatch({ type: 'NEXT' });
        })();
        return;
      }
      if (cur.phase !== 'ANSWERING' && cur.phase !== 'REVERSE_QA') return;
      pushLine({ who: 'me', text: t, kind: 'a' });
      dispatch({ type: 'ANSWER_SUBMIT', text: t });
    },
    [dispatch, icebreakOpen, icebreakerId, L, plan, pushLine, say],
  );

  const skip = useCallback(() => {
    pushLine({ who: 'me', text: translate(setup.uiLang, 'room.pass'), kind: 'a' });
    dispatch({ type: 'SKIP' });
  }, [dispatch, pushLine, setup.uiLang]);

  const answerOpen = (s.phase === 'ANSWERING' || s.phase === 'REVERSE_QA' || (s.phase === 'ICEBREAK' && icebreakOpen)) && !speaking;

  return {
    status, plan: plan ?? s.plan, state: s, lines, speaking, report, basicPlan, icebreakOpen, answerOpen, chunks,
    nameOf, setPanel: (p: PanelApi | null) => (panelRef.current = p),
    submit, skip, skipSpeech,
    next: () => dispatch({ type: 'NEXT' }),
    retry: () => dispatch({ type: 'RETRY' }),
    pause: () => {
      skipSpeech();
      dispatch({ type: 'PAUSE' });
    },
    resume: () => {
      handled.current = '';
      dispatch({ type: 'RESUME' });
    },
    endEarly: () => {
      skipSpeech();
      dispatch({ type: 'END_EARLY' });
    },
  };
}
