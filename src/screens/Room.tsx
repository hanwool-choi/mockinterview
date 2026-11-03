import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../components/Icon';
import { SheetProgress } from '../components/Sheet';
import { sheetRows } from '../landing/rows';
import type { Report } from '../../shared/schema';
import { AnswerBox } from '../components/AnswerBox';
import { SupportPip } from '../components/Support';
import { ScoreCard } from '../components/ScoreCard';
import { membersFor, Stage } from '../components/Stage';
import { currentQuestion, type InterviewState } from '../engine/machine';
import { translate, useT, type Key } from '../i18n';
import type { Setup } from '../state/setup';
import { useInterview } from '../state/useInterview';

export function Room({ setup, sid, fast, onDone }: { setup: Setup; sid: string; fast: boolean; onDone: (r: Report, s: InterviewState) => void }) {
  const t = useT();
  const iv = useInterview(setup, sid, { fast });
  const { state, plan } = iv;
  const logRef = useRef<HTMLDivElement>(null);
  const [openEv, setOpenEv] = useState<number | null>(null);

  const titleOf = (id: string) => {
    const fromPlan = plan.interviewers.find((i) => i.id === id)?.title;
    const cfg = setup.interviewers.find((i) => i.id === id)!;
    return fromPlan || `${translate(setup.lang, `role.${cfg.role}` as Key)} · ${translate(setup.lang, `rank.${cfg.rank}` as Key)}`;
  };
  // Recomputed every render: names arrive with the plan (or its fallback) after the stage mounts.
  const members = membersFor(setup, iv.nameOf, titleOf);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [iv.lines.length, state.phase]);

  useEffect(() => {
    if (iv.status === 'done' && iv.report) onDone(iv.report, iv.state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iv.status, iv.report]);

  const q = currentQuestion(state);
  const last = state.items[state.items.length - 1];
  const scoredQs = plan.questions.length;
  const nameOf = (who: string) => (who === 'me' ? t('room.you') : iv.nameOf(who));

  return (
    <main className="room" data-testid="room" style={{ '--count': plan.questions.length + 1 } as CSSProperties}>
      <header className="room-head">
        <div>
          <b>{setup.company}</b>
          {q && iv.status === 'running' && (
            <span className="stage-pill">
              {t(`stage.${q.stage}` as Key)} · {t('room.progress', { i: Math.min(state.qIndex + 1, scoredQs), n: scoredQs })}
            </span>
          )}
        </div>
        <SheetProgress
          ariaLabel={t('room.routeLabel')}
          cells={sheetRows(plan, setup.uiLang).map((st, i) => {
            const pre = state.phase === 'LOBBY' || state.phase === 'GREETING' || state.phase === 'ICEBREAK';
            const finished = iv.status !== 'running' || state.phase === 'CLOSING' || state.phase === 'REPORT';
            const qi = i - 1;
            const stateOf = finished ? 'done' : i === 0 ? (pre ? 'now' : 'done') : pre ? 'next' : qi < state.qIndex ? 'done' : qi === state.qIndex ? 'now' : 'next';
            const scored = state.items.find((it) => it.questionId === st.id && it.score && !it.skipped);
            const mark = i === 0 ? undefined : state.items.some((it) => it.questionId === st.id && it.skipped) ? '–' : setup.mode === 'practice' && scored ? scored.score!.grade : undefined;
            return { id: st.id, label: st.label, state: stateOf as 'done' | 'now' | 'next', mark };
          })}
        />
        <div className="room-actions">
          {state.phase === 'PAUSED' ? (
            <button className="ghost small" onClick={iv.resume}>
              <Icon name="play" size={16} /> {t('room.resume')}
            </button>
          ) : (
            <button className="ghost small" onClick={iv.pause} disabled={iv.status !== 'running'}>
              <Icon name="pause" size={16} /> {t('room.pause')}
            </button>
          )}
          <button className="ghost small danger" disabled={iv.status !== 'running'} onClick={() => window.confirm(t('room.endConfirm')) && iv.endEarly()}>
            {t('room.end')}
          </button>
        </div>
      </header>
      <SupportPip where="room" autoHideMs={15000} show={state.items.length >= 3 && (state.phase === 'FEEDBACK' || state.phase === 'TRANSITION' || state.phase === 'ASK')} />
      <div className="room-body">
        <div className="stage-col">
        <section className="stage-wrap">
          <Stage members={members} threeD={setup.threeD} onApi={iv.setPanel} speakingId={iv.speaking?.id ?? null} />
          {iv.speaking && (
            <div className="subtitle" aria-live="polite">
              <b>{iv.nameOf(iv.speaking.id)}</b> {iv.speaking.text}
              <button className="skip" data-testid="skip-speech" onClick={iv.skipSpeech}>
                {t('room.skipSpeech')}
              </button>
            </div>
          )}
          {iv.status === 'planning' && <div className="overlay">{t('room.reviewing')}</div>}
          {iv.status === 'reporting' && (
            <div className="overlay">
              <div className="overlay-msg">
                <b>{t('room.making')}</b>
                <span>{t('support.reporting')}</span>
              </div>
            </div>
          )}
          {state.phase === 'PAUSED' && <div className="overlay">{t('room.paused')}</div>}
        </section>
        {q && iv.status === 'running' && state.phase !== 'GREETING' && state.phase !== 'ICEBREAK' && (
          <section className="now-asking" aria-live="polite">
            <span className="who">
              {iv.nameOf(state.pendingFollowUp?.askedBy ?? q.askedBy)}
              {state.pendingFollowUp && <em className="tag">{t('room.followUp')}</em>}
            </span>
            <p>{state.pendingFollowUp?.text ?? q.text}</p>
          </section>
        )}
        </div>
        <section className="chat">
          {iv.aiNote && <p className="notice" data-testid="ai-note">{t(iv.aiNote === 'paused' ? 'room.aiPaused' : 'room.aiBudget')}</p>}
          <div className="log" ref={logRef}>
            {iv.lines.map((l) => {
              const qq = l.questionId ? plan.questions.find((x) => x.id === l.questionId) : undefined;
              const ev = qq?.evidenceIds.map((id) => iv.chunks.find((c) => c.id === id)).filter(Boolean) ?? [];
              return (
                <div key={l.id} className={`msg ${l.who === 'me' ? 'me' : 'them'} ${l.kind}`}>
                  <span className="who">
                    {nameOf(l.who)}
                    {l.followUp && <em className="tag">{t('room.followUp')}</em>}
                  </span>
                  <p>{l.text}</p>
                  {l.kind === 'q' && !l.followUp && ev.length > 0 && (
                    <>
                      <button className="link small" onClick={() => setOpenEv(openEv === l.id ? null : l.id)}>
                        {t('room.evidence')}
                      </button>
                      {openEv === l.id && (
                        <blockquote className="evidence">
                          {ev.map((c) => (
                            <p key={c!.id}>
                              <code>{c!.id}</code> {c!.text}
                            </p>
                          ))}
                        </blockquote>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {state.phase === 'SCORING' && <p className="typing">{t('room.scoring')}</p>}
          </div>
          {state.phase === 'FEEDBACK' && last?.score ? (
            <ScoreCard score={last.score} question={q} lang={setup.lang} onNext={iv.next} onRetry={iv.retry} canRetry={state.retriesUsed < 1 && !last.followUp} />
          ) : (
            <AnswerBox
              lang={setup.lang}
              stage={q?.stage}
              enabled={iv.answerOpen}
              icebreak={state.phase === 'ICEBREAK'}
              onSubmit={iv.submit}
              onSkip={iv.skip}
              intent={q?.intent}
              showIntent={setup.mode === 'practice'}
            />
          )}
        </section>
      </div>
    </main>
  );
}
