import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useT } from '../i18n';
import { Icon } from './Icon';

/** Where the support link points; empty until the operator sets DONATE_URL. */
export const DonateContext = createContext('');

function SupportButton({ where, small = false }: { where: string; small?: boolean }) {
  const t = useT();
  const url = useContext(DonateContext);
  if (!url) return <span className="support-soon">{t('support.soon')}</span>;
  return (
    <a className={`primary ${small ? 'small' : ''}`} href={url} target="_blank" rel="noopener noreferrer" onClick={() => api.track('support_click', where)}>
      <Icon name="heart" size={16} /> {t('support.cta')}
    </a>
  );
}

/** One line in the page: everything is free, support the token cost if it helped. */
export function SupportNote({ where }: { where: string }) {
  const t = useT();
  return (
    <aside className="support-note" data-testid={`support-note-${where}`}>
      <span className="support-heart">
        <Icon name="heart" size={18} />
      </span>
      <p>{t('support.inline')}</p>
      <SupportButton where={where} small />
    </aside>
  );
}

const seenKey = (where: string) => `iv:pip:${where}`;

/** A small dismissible card in the corner, once per place per session. It never blocks the page. */
export function SupportPip({ where, show, delayMs = 0, autoHideMs = 0 }: { where: string; show: boolean; delayMs?: number; autoHideMs?: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!show) return;
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(seenKey(where));
    } catch {
      /* private mode: show it */
    }
    if (seen) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      try {
        sessionStorage.setItem(seenKey(where), '1');
      } catch {
        /* ignore */
      }
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [show, where, delayMs]);

  useEffect(() => {
    if (!open || !autoHideMs) return;
    const timer = window.setTimeout(() => setOpen(false), autoHideMs);
    return () => window.clearTimeout(timer);
  }, [open, autoHideMs]);

  if (!open) return null;
  return (
    <aside className="support-pip no-print" role="dialog" aria-modal="false" aria-labelledby={`pip-${where}`} data-testid={`support-pip-${where}`}>
      <button className="pip-close" aria-label={t('support.close')} onClick={() => setOpen(false)}>
        <Icon name="x" size={16} />
      </button>
      <span className="support-heart">
        <Icon name="heart" size={20} />
      </span>
      <b id={`pip-${where}`}>{t('support.title')}</b>
      <p>{t('support.body')}</p>
      <div className="pip-actions">
        <SupportButton where={where} small />
        <button className="ghost small" onClick={() => setOpen(false)}>
          {t('support.later')}
        </button>
      </div>
    </aside>
  );
}
