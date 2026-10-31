import type { Lang, Rubric } from '../../shared/schema';
import { useT } from '../i18n';
import { rubricLabel } from './ScoreCard';

const KEYS: (keyof Rubric)[] = ['structure', 'specificity', 'jobFit', 'consistency', 'delivery'];

/** Single-series magnitude (0–20 per criterion): horizontal bars, one hue, value labels, native hover. */
export function RubricBars({ rubric, lang }: { rubric: Rubric; lang: Lang }) {
  const t = useT();
  return (
    <figure className="rubric-bars">
      <figcaption>{t('report.radar')}</figcaption>
      <table>
        <tbody>
          {KEYS.map((k) => {
            const v = rubric[k];
            return (
              <tr key={k} title={`${t(rubricLabel(k, lang))}: ${v} / 20`}>
                <th scope="row">{t(rubricLabel(k, lang))}</th>
                <td>
                  <div className="track">
                    <div className="bar" style={{ width: `${(v / 20) * 100}%` }} />
                  </div>
                </td>
                <td className="val">
                  {v}
                  <small>/20</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </figure>
  );
}
