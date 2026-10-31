import type { InterviewerConfig, Question } from '../../shared/schema';

export const iv = (id: string, role: InterviewerConfig['role'], rank: InterviewerConfig['rank'], personality: InterviewerConfig['personality'] = 'warm'): InterviewerConfig =>
  ({ id, role, rank, gender: 'none', personality, seed: id.length * 7 });

export const q = (id: string, stage: Question['stage'], askedBy = 'a', extra: Partial<Question> = {}): Question => ({
  id, stage, askedBy, text: `${id} text`, intent: '', mustHit: [], redFlags: [], evidenceIds: [], answerOutline: '', followUpSeeds: ['f1', 'f2'], ...extra,
});
