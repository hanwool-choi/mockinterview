import type { InterviewerConfig, Personality, Rank, Stage } from '../../shared/schema';

const RANK_ORDER: Rank[] = ['staff', 'manager', 'lead', 'exec'];
const r = (i: InterviewerConfig) => RANK_ORDER.indexOf(i.rank);

export function mostSenior(ivs: InterviewerConfig[]): InterviewerConfig {
  return ivs.reduce((best, i) => (r(i) > r(best) ? i : best), ivs[0]);
}

function practitioner(ivs: InterviewerConfig[]): InterviewerConfig {
  const nonHr = ivs.filter((i) => i.role !== 'hr');
  if (!nonHr.length) return mostSenior(ivs);
  return nonHr.reduce((best, i) => (r(i) < r(best) ? i : best), nonHr[0]);
}

export function assignInterviewers(stage: Stage, ivs: InterviewerConfig[]): string {
  if (ivs.length === 1) return ivs[0].id;
  switch (stage) {
    case 'motivation':
    case 'situational':
      return (ivs.find((i) => i.role === 'hr') ?? mostSenior(ivs)).id;
    case 'experience':
    case 'competency':
      return practitioner(ivs).id;
    default:
      return mostSenior(ivs).id;
  }
}

export const followUpLimit = (p: Personality): number => (p === 'pressure' ? 2 : 1);
