import type { CSSProperties, ReactNode } from 'react';
import type { Lang, Report, Rubric } from '../../shared/schema';
import { useT, type Key } from '../i18n';
import { Icon } from './Icon';

export const RUBRIC_KEYS: (keyof Rubric)[] = ['structure', 'specificity', 'jobFit', 'consistency', 'delivery'];

export function rubricLabel(k: keyof Rubric, lang: Lang): Key {
  return k === 'delivery' && lang === 'en' ? 'rubric.deliveryEn' : (`rubric.${k}` as Key);
}

/** Small round status marks used for STAR parts and checklists. */
export function CheckIcon() {
  return (
    <span className="mark mark-ok" aria-hidden="true">
      <Icon name="check" size={14} />
    </span>
  );
}
export function CrossIcon() {
  return (
    <span className="mark mark-no" aria-hidden="true">
      <Icon name="x" size={13} />
    </span>
  );
}
export function WeakIcon() {
  return (
    <span className="mark mark-weak" aria-hidden="true">
      !
    </span>
  );
}

/** Evaluation rows: criterion, a purple bar out of 20, and the points. */
export function RubricGrid({ rubric, lang, caption, compact = false }: { rubric: Partial<Rubric>; lang: Lang; caption?: ReactNode; compact?: boolean }) {
  const t = useT();
  return (
    <div className={`rubric ${compact ? 'compact' : ''}`}>
      {caption && <p className="rubric-caption">{caption}</p>}
      <ul>
        {RUBRIC_KEYS.map((k, i) => {
          const v = rubric[k];
          return (
            <li key={k} style={{ '--i': i } as CSSProperties}>
              <span className="rubric-label">{t(rubricLabel(k, lang))}</span>
              <span className="track" role="meter" aria-valuemin={0} aria-valuemax={20} aria-valuenow={v ?? 0} aria-label={t(rubricLabel(k, lang))}>
                <span className="bar" style={{ width: `${((v ?? 0) / 20) * 100}%` }} />
              </span>
              <span className="pts">
                <b>{typeof v === 'number' ? v : '–'}</b>/20
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The verdict as a coloured badge. */
export function VerdictBadge({ verdict, label }: { verdict: Report['publicSummary']['verdict']; label: string }) {
  return <span className={`verdict-badge v-${verdict}`}>{label}</span>;
}

/** Label / value pairs at the top of the sheet. */
export function SheetFields({ fields }: { fields: [string, ReactNode][] }) {
  return (
    <dl className="sheet-fields">
      {fields.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export type Cell = { id: string; label: string; state: 'done' | 'now' | 'next'; mark?: string };

/** Interview progress: one numbered step per question; done steps carry a grade or a check. */
export function SheetProgress({ cells, ariaLabel, showLabels = false }: { cells: Cell[]; ariaLabel: string; showLabels?: boolean }) {
  return (
    <ol className={`steps ${showLabels ? 'with-labels' : ''}`} aria-label={ariaLabel}>
      {cells.map((c, i) => (
        <li key={c.id} className={`step ${c.state}`} aria-current={c.state === 'now' ? 'step' : undefined} title={c.label}>
          <span className="step-dot">{c.state === 'done' ? (c.mark ? c.mark : <Icon name="check" size={12} />) : i}</span>
          {showLabels && <span className="step-l">{c.label}</span>}
        </li>
      ))}
    </ol>
  );
}
