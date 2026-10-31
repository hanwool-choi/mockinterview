import { z } from 'zod';

export const LANGS = ['ko', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export type Personality = 'warm' | 'strict' | 'pressure';
export type Rank = 'staff' | 'manager' | 'lead' | 'exec';
export type Role = 'dev' | 'hr' | 'sales' | 'design' | 'finance' | 'other';
export type Gender = 'male' | 'female' | 'none';

export type InterviewerConfig = {
  id: string;
  role: Role;
  rank: Rank;
  gender: Gender;
  personality: Personality;
  seed: number;
};

export type DocKind = 'resume' | 'portfolio' | 'jd';
export type Chunk = { id: string; kind: DocKind; text: string };

export const STAGES = ['intro', 'motivation', 'experience', 'competency', 'company', 'situational', 'reverse', 'closing'] as const;
export type Stage = (typeof STAGES)[number];

export const EXPRESSIONS = ['smile', 'nod', 'tilt', 'frown', 'neutral'] as const;
export const ExpressionSchema = z.enum(EXPRESSIONS);
export type Expression = z.infer<typeof ExpressionSchema>;

const str = z.string();
const strList = z.array(z.string()).default([]);

export const QuestionSchema = z.object({
  id: str,
  stage: z.enum(STAGES),
  askedBy: str,
  text: str.min(1),
  intent: str.default(''),
  mustHit: strList,
  redFlags: strList,
  evidenceIds: strList,
  answerOutline: str.default(''),
  followUpSeeds: z.array(str).default([]),
});
export type Question = z.infer<typeof QuestionSchema>;

export const PlanSchema = z.object({
  interviewers: z.array(z.object({ id: str, displayName: str, title: str.default(''), greeting: str.default('') })).min(1),
  smallTalk: z.object({ opening: strList, transitions: strList, acknowledgements: strList }),
  questions: z.array(QuestionSchema).min(1),
});
export type Plan = z.infer<typeof PlanSchema>;

const point = z.coerce.number();
export const RubricSchema = z.object({
  structure: point, specificity: point, jobFit: point, consistency: point, delivery: point,
});
export type Rubric = z.infer<typeof RubricSchema>;

export const GRADES = ['S', 'A', 'B', 'C', 'D'] as const;
export type Grade = (typeof GRADES)[number];

export const ReactionSchema = z.object({ interviewerId: str, expression: ExpressionSchema, line: str.optional() });

export const ScoreSchema = z.object({
  score: point,
  grade: z.enum(GRADES).default('C'),
  rubric: RubricSchema,
  strengths: strList,
  improvements: strList,
  flaggedPhrases: strList,
  betterAnswer: str.default(''),
  languageNotes: z.array(z.object({ original: str, better: str })).optional(),
  followUp: z.object({ needed: z.boolean(), askedBy: str.default(''), text: str.default('') }).nullable().default(null),
  reactions: z.array(ReactionSchema).default([]),
  summary: str.default(''),
});
export type Score = z.infer<typeof ScoreSchema> & { local?: boolean };

export const VERDICTS = ['pass', 'hold', 'fail'] as const;
export const ReportSchema = z.object({
  publicSummary: z.object({
    company: str, role: str.default(''), grade: z.enum(GRADES), score: point,
    verdict: z.enum(VERDICTS), oneLiner: str,
  }),
  privateDetail: z.object({
    verdictReason: str,
    interviewerComments: z.array(z.object({ interviewerId: str, comment: str })).default([]),
    top3Strengths: strList,
    top3Fixes: strList,
    nextQuestions: strList,
  }),
});
export type Report = z.infer<typeof ReportSchema> & { local?: boolean };
