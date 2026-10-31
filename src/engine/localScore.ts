import { normalizeScore } from '../../shared/grade';
import type { Lang, Question, Score } from '../../shared/schema';

const FILLERS = { ko: ['음', '어', '그냥', '약간', '뭔가'], en: ['um', 'uh', 'like', 'basically', 'you know'] };

export function localScore(q: Question, answer: string, lang: Lang): Score {
  const a = answer.replace(/\s+/g, ' ').trim();
  const low = a.toLowerCase();
  const ko = lang === 'ko';
  const words = a ? a.split(' ').length : 0;
  const size = ko ? a.length : words;
  const short = ko ? size < 80 : size < 15;
  const first = a.split(/(?<=[.?!다요])\s/)[0] ?? '';
  const firstOk = first.length > 0 && (ko ? first.length < 90 : first.split(' ').length <= 25);
  const nums = (a.match(/\d[\d,.]*/g) ?? []).length;
  const hit = q.mustHit.filter((m) => low.includes(m.toLowerCase()));
  const miss = q.mustHit.filter((m) => !low.includes(m.toLowerCase()));
  const red = q.redFlags.filter((w) => w && low.includes(w.toLowerCase()));
  const fillers = FILLERS[lang].filter((f) => new RegExp(`(^|\\s)${f}(\\s|,|$)`, 'i').test(a)).length;
  const [lo, hi, mid] = ko ? [200, 480, 120] : [60, 150, 40];

  const rubric = {
    structure: (firstOk ? 14 : 8) + (size >= lo && size <= hi ? 6 : size >= mid ? 3 : 0),
    specificity: Math.min(20, 6 + nums * 3),
    jobFit: q.mustHit.length ? Math.round(4 + (16 * hit.length) / q.mustHit.length) : 10,
    consistency: 14,
    delivery: (ko ? (size >= 150 && size <= 600 ? 16 : size >= 80 ? 12 : 6) : size >= 50 && size <= 200 ? 16 : size >= 15 ? 12 : 6) - fillers * 2,
  };
  if (short) for (const k of Object.keys(rubric) as (keyof typeof rubric)[]) rubric[k] = Math.round(rubric[k] / 2);
  let penalty = red.length * 8;
  const take = Math.min(rubric.consistency, penalty);
  rubric.consistency -= take;
  penalty -= take;
  rubric.delivery = Math.max(0, rubric.delivery - penalty);

  const improvements: string[] = [];
  if (short) improvements.push(ko ? `분량이 짧습니다(${a.length}자). 말로 40~60초가 되려면 250~400자가 적당합니다.` : `Too short (${words} words). Aim for 80–150 words.`);
  miss.slice(0, 3).forEach((m) => improvements.push(ko ? `'${m}' 관련 내용이 빠졌습니다.` : `You did not cover "${m}".`));
  if (nums < 2) improvements.push(ko ? '숫자가 거의 없습니다. 규모·기간·비율 중 하나라도 넣으세요.' : 'Add numbers: scale, time or percentage.');
  const strengths: string[] = [];
  if (hit.length) strengths.push(ko ? `핵심 포인트를 짚었습니다: ${hit.join(', ')}` : `Covered key points: ${hit.join(', ')}`);
  if (nums >= 2) strengths.push(ko ? '수치 근거를 제시했습니다.' : 'Backed claims with numbers.');
  if (firstOk && !short) strengths.push(ko ? '첫 문장이 간결합니다.' : 'Concise opening sentence.');

  const s = normalizeScore({
    score: 0, grade: 'D', rubric, strengths, improvements, flaggedPhrases: red, betterAnswer: '',
    followUp: null, reactions: [], summary: a.slice(0, 80),
  });
  if (s.score < 70 && q.followUpSeeds[0]) s.followUp = { needed: true, askedBy: q.askedBy, text: q.followUpSeeds[0] };
  return { ...s, local: true };
}
