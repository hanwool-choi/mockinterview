import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { Lang, Stage } from '../../shared/schema';
import { estimateSpeechSec, STAGE_TARGET_SEC } from '../engine/machine';
import { useT } from '../i18n';
import { createStt } from '../voice/stt';

type Props = { lang: Lang; stage?: Stage; enabled: boolean; icebreak: boolean; onSubmit: (t: string) => void; onSkip: () => void; intent?: string; showIntent: boolean };

export function AnswerBox({ lang, stage, enabled, icebreak, onSubmit, onSkip, intent, showIntent }: Props) {
  const t = useT();
  // Phones have no Ctrl+Enter: the placeholder drops that hint on touch screens.
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [openIntent, setOpenIntent] = useState(false);
  const stt = useMemo(() => createStt(lang), [lang]);
  const started = useRef<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (enabled) {
      started.current = Date.now();
      ref.current?.focus({ preventScroll: true });
    } else if (listening) {
      stt.stop();
      setListening(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const submit = () => {
    if (!enabled || !text.trim()) return;
    if (listening) stt.stop(), setListening(false);
    onSubmit(text);
    setText('');
    setOpenIntent(false);
  };

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sec = estimateSpeechSec(text, lang);
  const [a, b] = stage ? STAGE_TARGET_SEC[stage] : [30, 90];
  const tone = !text ? '' : sec < a ? 'short' : sec > b ? 'long' : 'ok';

  return (
    <div className={`answer-box ${enabled ? '' : 'disabled'}`}>
      {icebreak && enabled && (
        <button className="chip" data-testid="icebreak-reply" onClick={() => onSubmit(t('room.icebreakReply'))}>
          {t('room.icebreakReply')}
        </button>
      )}
      {showIntent && intent && enabled && !icebreak && (
        <div className="intent">
          <button className="link" onClick={() => setOpenIntent((v) => !v)}>
            {t('room.intent')}
          </button>
          {openIntent && <p>{intent}</p>}
        </div>
      )}
      <textarea
        ref={ref}
        data-testid="answer-input"
        disabled={!enabled}
        value={text}
        maxLength={6000}
        placeholder={enabled ? t(touch ? 'room.placeholderTouch' : 'room.placeholder') : t('room.waiting')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="answer-bar">
        <span className={`count ${tone}`}>
          {!icebreak && text && (lang === 'ko' ? t('room.count', { n: text.length, s: sec, a, b }) : t('room.countEn', { n: words, s: sec, a, b }))}
        </span>
        <div className="answer-actions">
          {stt.supported && (
            <button
              className={`ghost mic ${listening ? 'on' : ''}`}
              disabled={!enabled}
              title={t('room.micNote')}
              onClick={() => {
                if (listening) {
                  stt.stop();
                  setListening(false);
                } else {
                  const prefix = text ? text + ' ' : '';
                  stt.start((full) => setText(prefix + full), () => setListening(false));
                  setListening(true);
                }
              }}
            >
              {listening ? <><Icon name="stop" /> {t('room.micStop')}</> : <><Icon name="mic" /> {t('room.mic')}</>}
            </button>
          )}
          {!icebreak && (
            <button className="ghost" disabled={!enabled} onClick={onSkip} data-testid="answer-skip">
              {t('room.pass')}
            </button>
          )}
          <button className="primary" disabled={!enabled || !text.trim()} onClick={submit} data-testid="answer-submit">
            {t('room.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
