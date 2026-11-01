import { z } from 'zod';
import type { PlanRequest } from '../../shared/api';
import { QuestionSchema, STAGES, type Plan, type Stage } from '../../shared/schema';
import { fakePlan } from './fake';

/** The plan is generated in three smaller parts that run in parallel (one big call took ~3 minutes on free models). */
export type PartName = 'frame' | 'experience' | 'competency';
export const PART_STAGES: Record<PartName, Stage[]> = {
  frame: ['intro', 'motivation', 'company', 'situational', 'reverse', 'closing'],
  experience: ['experience'],
  competency: ['competency'],
};
export const PART_COUNTS: Record<PartName, number> = { frame: 6, experience: 3, competency: 2 };

export const FramePartSchema = z.object({
  interviewers: z.array(z.object({ id: z.string(), displayName: z.string(), title: z.string().default(''), greeting: z.string().default('') })).min(1),
  smallTalk: z.object({ opening: z.array(z.string()).default([]), transitions: z.array(z.string()).default([]), acknowledgements: z.array(z.string()).default([]) }),
  questions: z.array(QuestionSchema).min(1),
});
export const QuestionsPartSchema = z.object({ questions: z.array(QuestionSchema).min(1) });
export type FramePart = z.infer<typeof FramePartSchema>;
export type QuestionsPart = z.infer<typeof QuestionsPartSchema>;

const ORDER = new Map<Stage, number>(STAGES.map((s, i) => [s, i]));

export function mergePlanParts(req: PlanRequest, frame: FramePart | null, exp: QuestionsPart | null, comp: QuestionsPart | null): Plan | null {
  if (!frame && !exp && !comp) return null;
  const pick = (part: PartName, qs: Plan['questions'] | undefined) =>
    (qs ?? []).filter((q) => PART_STAGES[part].includes(q.stage)).slice(0, part === 'frame' ? 12 : PART_COUNTS[part]).map((q, i) => ({ ...q, id: `${part[0]}${i + 1}` }));
  const questions = [...pick('frame', frame?.questions), ...pick('experience', exp?.questions), ...pick('competency', comp?.questions)]
    .map((q, i) => ({ q, i }))
    .sort((a, b) => (ORDER.get(a.q.stage)! - ORDER.get(b.q.stage)!) || a.i - b.i)
    .map(({ q }) => q);
  const fallback = fakePlan({ ...req, chunks: [] });
  const known = new Set(req.interviewers.map((i) => i.id));
  const names = frame?.interviewers.filter((i) => known.has(i.id)) ?? [];
  return {
    interviewers: req.interviewers.map((iv) => names.find((n) => n.id === iv.id) ?? fallback.interviewers.find((n) => n.id === iv.id)!),
    smallTalk: frame?.smallTalk ?? fallback.smallTalk,
    questions,
  };
}
