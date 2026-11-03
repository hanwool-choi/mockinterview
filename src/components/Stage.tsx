import { useEffect, useState } from 'react';
import type { InterviewerConfig } from '../../shared/schema';
import { stateFor, type AvatarState } from '../avatar/expression';
import { Interviewer } from '../avatar/Interviewer';
import { lookFor, type Look } from '../avatar/look';
import type { PanelApi } from '../state/useInterview';
import type { Setup } from '../state/setup';

export type Member = { cfg: InterviewerConfig; look: Look; name: string; title: string };

export function membersFor(setup: Setup, nameOf: (id: string) => string, titleOf: (id: string) => string): Member[] {
  return setup.interviewers.map((cfg) => ({ cfg, look: lookFor(cfg, setup.overrides[cfg.id]), name: nameOf(cfg.id), title: titleOf(cfg.id) }));
}

const HOLD_MS: Record<AvatarState, number> = { neutral: 0, smile: 3200, serious: 3600, doubt: 3200, nod: 1400, memo: 0 };

/** The panel behind the desk: 2D illustrated interviewers driven through PanelApi. */
export function Stage({ members, onApi, speakingId }: { members: Member[]; threeD?: boolean; onApi: (api: PanelApi | null) => void; speakingId: string | null }) {
  const [states, setStates] = useState<Record<string, AvatarState>>({});
  const [writing, setWriting] = useState<Record<string, boolean>>({});
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const timers = new Map<string, number>();
    onApi({
      setExpression: (id, e) => {
        const s = stateFor(e);
        setStates((x) => ({ ...x, [id]: s }));
        window.clearTimeout(timers.get(id));
        if (HOLD_MS[s]) timers.set(id, window.setTimeout(() => setStates((x) => ({ ...x, [id]: 'neutral' })), HOLD_MS[s]));
      },
      setSpeaking: () => {},
      setAction: (id, a) => setWriting((x) => ({ ...x, [id]: a === 'write' })),
      focus: () => {},
    });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      onApi(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stage-2d" data-count={members.length}>
      <div className="panel-row">
        {members.map((m) => {
          const speaking = speakingId === m.cfg.id;
          const st = states[m.cfg.id] ?? 'neutral';
          // Writing shows only while the interviewer is not talking and has no stronger reaction on.
          const state: AvatarState = writing[m.cfg.id] && !speaking && st === 'neutral' ? 'memo' : st;
          return (
            <figure key={m.cfg.id} className={`seat ${speaking ? 'speaking' : ''}`} data-testid={`seat-${m.cfg.id}`} data-state={state}>
              <Interviewer look={m.look} state={state} speaking={speaking} title={`${m.name} ${m.title}`} live={!reduced} seed={m.cfg.seed} />
              <figcaption className="nameplate">
                <b>{m.name}</b>
                <span>{m.title}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
      <div className="desk" aria-hidden="true" />
    </div>
  );
}
