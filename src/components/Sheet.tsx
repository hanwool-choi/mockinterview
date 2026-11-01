import type { CSSProperties, ReactNode } from 'react';
import type { Lang, Report, Rubric } from '../../shared/schema';
import { useT, type Key } from '../i18n';

export const RUBRIC_KEYS: (keyof Rubric)[] = ['structure', 'specificity', 'jobFit', 'consistency', 'delivery'];
const SCALE = [1, 2, 3, 4, 5] as const;

export function rubricLabel(k: keyof Rubric, lang: Lang): Key {
  return k === 'delivery' && lang === 'en' ? 'rubric.deliveryEn' : (`rubric.${k}` as Key);
}

/** 0–20 points onto the sheet's five printed columns. */
export function scaleOf(points: number): number {
  return Math.min(5, Math.max(1, Math.ceil(points / 4)));
}

/** A hand-drawn red-pen ring around a printed cell. Drawn with a stroke so it can be "written" in. */
export function PenRing({ seed = 0 }: { seed?: number }) {
  const tilt = [-6, 4, -2, 7, -4][seed % 5];
  return (
    <svg className="pen-ring" viewBox="0 0 100 60" aria-hidden="true" style={{ '--tilt': `${tilt}deg` } as CSSProperties} preserveAspectRatio="none">
      <path pathLength={1} d="M58 6 C 88 6, 97 20, 95 32 C 92 50, 66 56, 46 55 C 20 54, 4 44, 5 29 C 6 14, 26 5, 52 5 C 60 5, 66 7, 70 9" />
    </svg>
  );
}

/** A pen check mark used for the STAR boxes and confirmations. */
export function PenCheck() {
  return (
    <svg className="pen-check" viewBox="0 0 24 24" aria-hidden="true">
      <path pathLength={1} d="M4 13 L10 19 L20 5" />
    </svg>
  );
}

/** A pen cross for a missing part. */
export function PenCross() {
  return (
    <svg className="pen-check" viewBox="0 0 24 24" aria-hidden="true">
      <path pathLength={1} d="M5 5 L19 19 M19 5 L5 19" />
    </svg>
  );
}

/** Printed rubric grid: label, five scale columns, points. A filled row carries a ring and a handwritten number. */
export function RubricGrid({
  rubric,
  lang,
  filled = 5,
  caption,
  compact = false,
}: {
  rubric: Partial<Rubric>;
  lang: Lang;
  filled?: number;
  caption?: ReactNode;
  compact?: boolean;
}) {
  const t = useT();
  return (
    <table className={`rubric-grid ${compact ? 'compact' : ''}`} data-ui>
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr>
          <th scope="col">{t('sheet.item')}</th>
          {SCALE.map((n) => (
            <th scope="col" key={n} className="scale">
              <span className="scale-n">{n}</span>
              {!compact && <span className="scale-l">{t(`sheet.scale${n}` as Key)}</span>}
            </th>
          ))}
          <th scope="col" className="pts">
            {t('sheet.points')}
          </th>
        </tr>
      </thead>
      <tbody>
        {RUBRIC_KEYS.map((k, i) => {
          const v = rubric[k];
          const on = i < filled && typeof v === 'number';
          const col = on ? scaleOf(v!) : 0;
          return (
            <tr key={k} className={on ? 'filled' : ''} style={{ '--i': i } as CSSProperties}>
              <th scope="row">{t(rubricLabel(k, lang))}</th>
              {SCALE.map((n) => (
                <td key={n} className="scale">
                  {col === n && <PenRing seed={i} />}
                  {col === n && <span className="visually-hidden">{t(`sheet.scale${n}` as Key)}</span>}
                </td>
              ))}
              <td className="pts">
                {on ? (
                  <>
                    <span className="hand">{v}</span>
                    <small className="of">/20</small>
                  </>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The verdict as a red ink stamp pressed onto the sheet. */
export function Stamp({ verdict, label }: { verdict: Report['publicSummary']['verdict']; label: string }) {
  return (
    <span className={`stamp stamp-${verdict}`} role="img" aria-label={label}>
      <span>{label}</span>
    </span>
  );
}

/** Header block of a printed form: label cells and value cells. */
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

/** The sheet's question row strip: one numbered box per question, filled in as the interview goes. */
export function SheetProgress({ cells, ariaLabel, showLabels = true }: { cells: Cell[]; ariaLabel: string; showLabels?: boolean }) {
  return (
    <ol className="sheet-progress" aria-label={ariaLabel} data-ui>
      {cells.map((c, i) => (
        <li key={c.id} className={`cell ${c.state}`} aria-current={c.state === 'now' ? 'step' : undefined} title={c.label}>
          <span className="cell-n">{i === 0 ? '0' : i}</span>
          <span className="cell-box">{c.state === 'done' && (c.mark ? <span className="hand">{c.mark}</span> : <PenCheck />)}</span>
          {showLabels && <span className="cell-l">{c.label}</span>}
        </li>
      ))}
    </ol>
  );
}
