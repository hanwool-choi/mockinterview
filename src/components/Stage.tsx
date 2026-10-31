import { useEffect, useMemo, useRef, useState } from 'react';
import type { Expression, InterviewerConfig } from '../../shared/schema';
import { Portrait2D } from '../avatar/Portrait2D';
import { faceTarget } from '../avatar/expression';
import { lookFor, type Look } from '../avatar/look';
import type { PanelApi } from '../state/useInterview';
import type { Setup } from '../state/setup';

export type Member = { cfg: InterviewerConfig; look: Look; name: string; title: string };

export function membersFor(setup: Setup, nameOf: (id: string) => string, titleOf: (id: string) => string): Member[] {
  return setup.interviewers.map((cfg) => ({ cfg, look: lookFor(cfg, setup.overrides[cfg.id]), name: nameOf(cfg.id), title: titleOf(cfg.id) }));
}

const webgl = (() => {
  let v: boolean | null = null;
  return () => {
    if (v !== null) return v;
    try {
      const c = document.createElement('canvas');
      v = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      v = false;
    }
    return v;
  };
})();

/** 3D stage when possible, otherwise 2D portraits; both expose the same PanelApi. */
export function Stage({ members, threeD, onApi, speakingId }: { members: Member[]; threeD: boolean; onApi: (api: PanelApi | null) => void; speakingId: string | null }) {
  const use3D = threeD && webgl();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [exprs, setExprs] = useState<Record<string, Expression>>({});
  const [failed, setFailed] = useState(false);
  const key = useMemo(() => members.map((m) => `${m.cfg.id}${m.name}${JSON.stringify(m.look)}`).join('|'), [members]);

  useEffect(() => {
    if (!use3D || failed || !canvasRef.current) return;
    let disposed = false;
    let stage: import('../avatar/stage').InterviewStage | null = null;
    import('../avatar/stage')
      .then(({ InterviewStage }) => {
        if (disposed || !canvasRef.current) return;
        const lowPower = window.matchMedia('(max-width: 767px)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        stage = new InterviewStage(canvasRef.current, members, { lowPower, reducedMotion });
        onApi({
          setExpression: (id, e) => stage?.setExpression(id, e),
          setSpeaking: (id, on) => stage?.setSpeaking(id, on),
          setAction: (id, a) => stage?.setAction(id, a),
          focus: (id) => stage?.focus(id),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      onApi(null);
      stage?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [use3D, failed, key]);

  useEffect(() => {
    if (use3D && !failed) return;
    const timers = new Map<string, number>();
    onApi({
      setExpression: (id, e) => {
        setExprs((x) => ({ ...x, [id]: e }));
        window.clearTimeout(timers.get(id));
        if (e !== 'neutral') timers.set(id, window.setTimeout(() => setExprs((x) => ({ ...x, [id]: 'neutral' })), 3200));
      },
      setSpeaking: () => {},
      setAction: () => {},
      focus: () => {},
    });
    return () => onApi(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [use3D, failed]);

  if (use3D && !failed) return <canvas ref={canvasRef} className="stage-canvas" aria-label="interview panel" />;
  return (
    <div className="stage-2d">
      {members.map((m) => (
        <figure key={m.cfg.id} className={speakingId === m.cfg.id ? 'speaking' : ''}>
          <Portrait2D look={m.look} face={faceTarget(exprs[m.cfg.id] ?? 'neutral', m.look.browBase)} speaking={speakingId === m.cfg.id} size={132} title={m.name} />
          <figcaption>
            <b>{m.name}</b>
            <span>{m.title}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
