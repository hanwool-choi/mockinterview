import type { InterviewLength } from '../../shared/api';
import type { InterviewerConfig, Lang } from '../../shared/schema';
import type { HairStyle } from '../avatar/look';

export type Docs = { jd: string; resume: string; portfolio: string };
export type Setup = {
  lang: Lang;
  uiLang: Lang;
  company: string;
  role: string;
  career: 'new' | 'exp';
  years?: number;
  name: string;
  docs: Docs;
  interviewers: InterviewerConfig[];
  overrides: Record<string, { skinTone?: string; hairStyle?: HairStyle }>;
  mode: 'practice' | 'real';
  /** quick: 3 questions + a short summary; full: 11 questions + the detailed report. Both free. */
  length: InterviewLength;
  voice: boolean;
  threeD: boolean;
};

export const defaultInterviewers = (): InterviewerConfig[] => [
  { id: 'iv1', role: 'other', rank: 'exec', gender: 'male', personality: 'strict', seed: 11 },
  { id: 'iv2', role: 'hr', rank: 'manager', gender: 'female', personality: 'warm', seed: 23 },
  { id: 'iv3', role: 'dev', rank: 'staff', gender: 'male', personality: 'warm', seed: 37 },
  { id: 'iv4', role: 'finance', rank: 'lead', gender: 'female', personality: 'pressure', seed: 41 },
];

export const emptySetup = (lang: Lang = 'ko'): Setup => ({
  lang, uiLang: lang, company: '', role: '', career: 'exp', years: 3, name: '',
  docs: { jd: '', resume: '', portfolio: '' },
  interviewers: defaultInterviewers().slice(0, 3), overrides: {}, mode: 'practice', length: 'full', voice: false, threeD: true,
});

const KEY = 'iv:setup';
export const loadSetup = (): Setup | null => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Setup | null;
  } catch {
    return null;
  }
};
export const saveSetup = (s: Setup) => sessionStorage.setItem(KEY, JSON.stringify(s));
