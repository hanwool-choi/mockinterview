import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useT } from '../i18n';
import { Icon } from './Icon';
import { opensOnPhone, qrPath } from './qr';

/** Support links from the server config (KAKAOPAY_URL, FAIRY_URL); an empty one hides its button. */
export type Donate = { kakao: string; fairy: string };
export const NO_DONATE: Donate = { kakao: '', fairy: '' };
export const DonateContext = createContext<Donate>(NO_DONATE);

/** Two ways to chip in: KakaoPay (opens the app on phones, a QR on PC) and Fairy (card, for when KakaoPay is busy). */
function SupportButton({ where, small = false }: { where: string; small?: boolean }) {
  const t = useT();
  const { kakao, fairy } = useContext(DonateContext);
  const [qr, setQr] = useState(false);
  if (!kakao && !fairy) return <span className="support-soon">{t('support.soon')}</span>;
  const size = small ? 'small' : '';
  return (
    <span className="support-buttons">
      {kakao && (
        <a
          className={`kakao-btn ${size}`}
          href={kakao}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="support-kakao"
          onClick={(e) => {
            api.track('support_click', `${where}:kakao`);
            // The transfer link only opens in the KakaoPay app: on a computer, show a QR to scan with the phone instead.
            if (!opensOnPhone(navigator.userAgent, matchMedia('(pointer: coarse)').matches)) {
              e.preventDefault();
              setQr(true);
            }
          }}
        >
          <Icon name="heart" size={16} /> {t('support.kakao')}
        </a>
      )}
      {qr && kakao && <KakaoQr url={kakao} onClose={() => setQr(false)} />}
      {fairy && (
        <a className={`secondary ${size}`} href={fairy} target="_blank" rel="noopener noreferrer" data-testid="support-fairy" onClick={() => api.track('support_click', `${where}:fairy`)}>
          {t('support.fairy')}
        </a>
      )}
    </span>
  );
}

/** A modal with the transfer QR: scan it with the phone camera and KakaoPay opens on the transfer screen. */
function KakaoQr({ url, onClose }: { url: string; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const { size, d } = qrPath(url);
  useEffect(() => {
    const dlg = ref.current;
    dlg?.showModal();
    return () => dlg?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="kakao-qr no-print"
      aria-labelledby="kakao-qr-title"
      data-testid="kakao-qr"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button className="pip-close" aria-label={t('support.close')} onClick={onClose}>
        <Icon name="x" size={16} />
      </button>
      <b id="kakao-qr-title">{t('support.qrTitle')}</b>
      <p>{t('support.qrBody')}</p>
      <svg className="qr-code" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t('support.qrAlt')} shapeRendering="crispEdges">
        <rect width={size} height={size} fill="#fff" />
        <path d={d} fill="#191600" />
      </svg>
      <a className="qr-direct" href={url} target="_blank" rel="noopener noreferrer">
        {t('support.qrDirect')}
      </a>
    </dialog>
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
