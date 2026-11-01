import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import type { Gender, InterviewerConfig, Personality, Rank, Role } from '../../shared/schema';
import { api } from '../api/client';
import { Portrait2D } from '../avatar/Portrait2D';
import { faceTarget } from '../avatar/expression';
import { lookFor } from '../avatar/look';
import { useT, type Key } from '../i18n';
import { defaultInterviewers, type Setup } from '../state/setup';
import { createTts, voiceProfileFor } from '../voice/tts';

const ROLES: Role[] = ['other', 'hr', 'dev', 'sales', 'design', 'finance'];
const RANKS: Rank[] = ['staff', 'manager', 'lead', 'exec'];
const GENDERS: Gender[] = ['female', 'male', 'none'];
const PERSONAS: Personality[] = ['warm', 'strict', 'pressure'];

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, o: { sitekey: string; callback: (t: string) => void; 'error-callback'?: (code: string) => boolean | void; 'expired-callback'?: () => void; size?: string }): string;
      reset(id?: string): void;
    };
  }
}

function useTurnstile(siteKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const widget = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const render = () => {
      widget.current = window.turnstile?.render(ref.current!, {
        sitekey: siteKey,
        callback: (t) => {
          setError('');
          setToken(t);
        },
        'error-callback': (code) => {
          setToken('');
          setError(String(code || 'unknown'));
          return true;
        },
        'expired-callback': () => setToken(''),
      });
    };
    if (window.turnstile) return void render();
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = render;
    s.onerror = () => setError('script');
    document.head.appendChild(s);
  }, [siteKey]);
  // A token is single-use: get a fresh one after any failed start.
  const reset = () => {
    setToken('');
    window.turnstile?.reset(widget.current);
  };
  return { ref, token, error, reset, needed: !!siteKey };
}

export function Panel({ setup, onChange, onBack, onStart, siteKey }: { setup: Setup; onChange: (s: Setup) => void; onBack: () => void; onStart: (sid: string) => void; siteKey: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const ts = useTurnstile(siteKey);
  const ivs = setup.interviewers;

  const setCount = (n: number) => {
    const pool = defaultInterviewers();
    const next = Array.from({ length: n }, (_, i) => ivs[i] ?? pool[i]);
    onChange({ ...setup, interviewers: next });
  };
  const patch = (i: number, p: Partial<InterviewerConfig>) => onChange({ ...setup, interviewers: ivs.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  const start = async () => {
    setBusy(true);
    setMsg('');
    const r = await api.session(ts.token || undefined);
    setBusy(false);
    if (r.ok) return onStart(r.data.sid);
    ts.reset();
    setMsg(r.reason === 'device' ? t('quota.device', { n: 3 }) : r.reason === 'global' ? t('quota.global') : t('quota.error'));
  };

  return (
    <main className="panel-setup">
      <header className="screen-head">
        <button className="link" onClick={onBack}>
          <Icon name="arrowLeft" /> {t('common.back')}
        </button>
        <h1>{t('panel.title')}</h1>
        <span />
      </header>
      <div className="count-pick">
        <span>{t('panel.count')}</span>
        {[1, 2, 3, 4].map((n) => (
          <button key={n} className={ivs.length === n ? 'on' : ''} data-testid={`count-${n}`} onClick={() => setCount(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="iv-cards">
        {ivs.map((iv, i) => (
          <article key={iv.id} className="iv-card">
            <Portrait2D look={lookFor(iv, setup.overrides[iv.id])} face={faceTarget(iv.personality === 'pressure' ? 'frown' : iv.personality === 'warm' ? 'smile' : 'neutral', lookFor(iv).browBase)} size={96} />
            <div className="iv-fields">
              <label>
                {t('panel.role')}
                <select value={iv.role} onChange={(e) => patch(i, { role: e.target.value as Role })}>
                  {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}` as Key)}</option>)}
                </select>
              </label>
              <label>
                {t('panel.rank')}
                <select value={iv.rank} onChange={(e) => patch(i, { rank: e.target.value as Rank })}>
                  {RANKS.map((r) => <option key={r} value={r}>{t(`rank.${r}` as Key)}</option>)}
                </select>
              </label>
              <label>
                {t('panel.gender')}
                <select value={iv.gender} onChange={(e) => patch(i, { gender: e.target.value as Gender })}>
                  {GENDERS.map((g) => <option key={g} value={g}>{t(`gender.${g}` as Key)}</option>)}
                </select>
              </label>
              <label>
                {t('panel.personality')}
                <select value={iv.personality} data-testid={`personality-${i}`} onChange={(e) => patch(i, { personality: e.target.value as Personality })}>
                  {PERSONAS.map((p) => <option key={p} value={p}>{t(`persona.${p}` as Key)}</option>)}
                </select>
              </label>
              <button className="link" onClick={() => patch(i, { seed: iv.seed + 101 })}>
                <Icon name="shuffle" /> {t('panel.reroll')}
              </button>
            </div>
          </article>
        ))}
      </div>
      <section className="options">
        <fieldset className="mode-pick">
          <legend>{t('panel.mode')}</legend>
          {(['practice', 'real'] as const).map((m) => (
            <button key={m} className={`mode ${setup.mode === m ? 'on' : ''}`} data-testid={`mode-${m}`} onClick={() => onChange({ ...setup, mode: m })}>
              <b>{t(m === 'practice' ? 'panel.practice' : 'panel.real')}</b>
              <span>{t(m === 'practice' ? 'panel.practiceD' : 'panel.realD')}</span>
            </button>
          ))}
        </fieldset>
        <label className="toggle">
          <input type="checkbox" checked={setup.voice} onChange={(e) => onChange({ ...setup, voice: e.target.checked })} />
          <span>
            <b>{t('panel.voice')}</b>
            <small>{t('panel.voiceD')}</small>
          </span>
          {setup.voice && (
            <button
              className="ghost small"
              onClick={(e) => {
                e.preventDefault();
                void createTts({ prefer: 'os' }).speak(setup.lang === 'ko' ? '안녕하세요. 오늘 면접에 와주셔서 감사합니다.' : 'Hello, thank you for coming in today.', voiceProfileFor(ivs[0], setup.lang));
              }}
            >
              <Icon name="volume" /> {t('panel.preview')}
            </button>
          )}
        </label>
        <label className="toggle">
          <input type="checkbox" checked={setup.threeD} onChange={(e) => onChange({ ...setup, threeD: e.target.checked })} />
          <span>
            <b>{t('panel.three')}</b>
            <small>{t('panel.threeD')}</small>
          </span>
        </label>
      </section>
      <div ref={ts.ref} className="turnstile" />
      <footer className="screen-foot">
        {msg && <p className="warn" role="alert">{msg}</p>}
        {ts.needed && ts.error && (
          <p className="warn" role="alert" data-testid="turnstile-error">
            {t('panel.turnstileError', { code: ts.error })}
          </p>
        )}
        {ts.needed && !ts.token && !ts.error && <span className="muted">{t('panel.turnstileWait')}</span>}
        <button className="primary big" disabled={busy || (ts.needed && !ts.token)} onClick={start} data-testid="start-interview">
          {busy ? t('panel.starting') : <>{t('panel.start')} <Icon name="arrowRight" /></>}
        </button>
      </footer>
    </main>
  );
}
