import type { Lang, Plan } from '../../shared/schema';
import { STAGE_PLAN } from '../engine/templates';
import { translate, type Key } from '../i18n';
import { STATION_LABELS } from './copy';

export type RouteStation = { id: string; label: string; en: string; transfer: boolean };

/** One naming for the line everywhere: icebreak + one station per planned question. */
export function routeStations(plan: Plan, ui: Lang): RouteStation[] {
  const names = STATION_LABELS[ui];
  const seen: Record<string, number> = {};
  const qs = plan.questions.map((q) => {
    const k = seen[q.stage] ?? 0;
    seen[q.stage] = k + 1;
    let pos = -1;
    for (let i = 0, c = 0; i < STAGE_PLAN.length; i++) if (STAGE_PLAN[i] === q.stage && c++ === k) pos = i;
    const n = pos >= 0 ? names[pos + 1] : { label: translate(ui, `stage.${q.stage}` as Key), en: '' };
    return { id: q.id, label: n.label, en: n.en, transfer: q.stage === 'experience' };
  });
  return [{ id: 'icebreak', label: names[0].label, en: names[0].en, transfer: false }, ...qs];
}
