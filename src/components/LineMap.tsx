import type { CSSProperties } from 'react';

export type Station = { id: string; label: string; en: string; transfer?: boolean; mark?: string; state?: 'done' | 'now' | 'next' };

type Props = {
  stations: Station[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  size?: 'hero' | 'compact';
  ariaLabel: string;
};

/** The interview drawn as one metro line. Stations are buttons when selectable. */
export function LineMap({ stations, selected, onSelect, size = 'hero', ariaLabel }: Props) {
  const nowIndex = stations.findIndex((s) => s.state === 'now');
  const progress = nowIndex < 0 ? (stations.every((s) => s.state === 'done') ? 1 : 0) : nowIndex / Math.max(1, stations.length - 1);
  return (
    <nav className={`line-map line-${size}`} aria-label={ariaLabel} style={{ '--progress': progress } as CSSProperties}>
      <div className="line-track" aria-hidden="true">
        <span className="line-ridden" />
      </div>
      <ol>
        {stations.map((s) => {
          const content = (
            <>
              <span className={`dot ${s.transfer ? 'transfer' : ''}`} aria-hidden="true">
                {s.mark && <b>{s.mark}</b>}
              </span>
              <span className="name">{s.label}</span>
              {size === 'hero' && <span className="en">{s.en}</span>}
            </>
          );
          return (
            <li key={s.id} className={`station ${s.state ?? ''} ${selected === s.id ? 'selected' : ''}`}>
              {onSelect ? (
                <button type="button" aria-pressed={selected === s.id} onClick={() => onSelect(s.id)}>
                  {content}
                </button>
              ) : (
                <span className="station-static" aria-current={s.state === 'now' ? 'step' : undefined}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
