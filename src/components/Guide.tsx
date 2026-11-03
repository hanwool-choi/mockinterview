import type { Guide as G } from '../../shared/schema';
import { useT } from '../i18n';
import { CheckIcon, CrossIcon, WeakIcon } from './Sheet';

const PARTS = ['situation', 'task', 'action', 'result'] as const;

/** Per-answer coaching: verdict, STAR as four checkbox cells, fixes, phrase swaps, evidence, drill. */
export function GuideView({ guide, compact = false }: { guide: G; compact?: boolean }) {
  const t = useT();
  return (
    <div className={`guide ${compact ? 'compact' : ''}`} data-testid="guide">
      {guide.verdict && <p className="guide-verdict">{guide.verdict}</p>}
      {guide.star && (
        <ol className="star-line" aria-label={t('guide.star')}>
          {PARTS.map((k) => (
            <li key={k} className={`star-${guide.star![k]}`}>
              {guide.star![k] === 'ok' ? <CheckIcon /> : guide.star![k] === 'weak' ? <WeakIcon /> : <CrossIcon />}
              <b>{t(`guide.${k}`)}</b>
              <span className="visually-hidden">{t(`guide.${guide.star![k]}`)}</span>
            </li>
          ))}
        </ol>
      )}
      {!!guide.fixes.length && (
        <div className="guide-block">
          <h4>{t('guide.fixes')}</h4>
          <ul className="fixes">
            {guide.fixes.map((f, i) => (
              <li key={i}>
                <b>{f.point}</b>
                <span>{f.how}</span>
                {f.example && <q>{f.example}</q>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!guide.phrasing.length && (
        <div className="guide-block">
          <h4>{t('guide.phrasing')}</h4>
          <ul className="swaps">
            {guide.phrasing.map((p, i) => (
              <li key={i}>
                <s>{p.from}</s>
                <span aria-hidden="true">→</span>
                <b>{p.to}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
      {guide.evidence && (
        <p className="guide-note">
          <b>{t('guide.evidence')}</b> {guide.evidence}
        </p>
      )}
      {guide.drill && (
        <p className="guide-note drill">
          <b>{t('guide.drill')}</b> {guide.drill}
        </p>
      )}
    </div>
  );
}
