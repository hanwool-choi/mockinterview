import type { InterviewerConfig } from '../../shared/schema';

/**
 * Appearance of a 2D interviewer illustration. One art style for everyone; the impression comes from
 * rank (age band, formality), role (outfit, desk prop) and personality (resting brows).
 */
export type Age = 'young' | 'mid' | 'senior';
export type HairStyle = 'shortCrop' | 'sidePart' | 'sweptBack' | 'lowBun' | 'bob' | 'long' | 'ponytail';
export type OutfitKind = 'suit' | 'blazer' | 'shirt' | 'knit' | 'cardigan' | 'turtleneck';
export type Prop = 'laptop' | 'notebook' | 'cards' | 'tablet' | 'folder' | 'none';

export type Look = {
  gender: 'male' | 'female';
  age: Age;
  skin: string;
  hair: { style: HairStyle; color: string };
  outfit: { kind: OutfitKind; color: string; inner: string; tie: string | null };
  glasses: 'round' | 'rect' | null;
  lanyard: boolean;
  prop: Prop;
  /** Resting brow height from personality: negative reads stricter. */
  browBase: number;
};

export const SKIN_TONES = ['#f3d5c0', '#ebc3a5', '#dcab88', '#c68e6a', '#9b6a4b', '#6f4a33'];
const HAIR_DARK = ['#1d1a19', '#2a211c', '#3a2b22', '#4a3628'];
const HAIR_GRAY = ['#8e9196', '#a9acb1', '#6f7378'];
const NAVY = ['#1b1f2e', '#232a3d', '#2b3245'];
const SOFT = { beige: '#e9dcc8', ivory: '#f1ece2', sky: '#c9d6ea', sage: '#cdd8cc', lilac: '#d9d3ea', sand: '#d8c8b0' };

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rnd: () => number, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length) % xs.length];

const AGE: Record<InterviewerConfig['rank'], Age> = { staff: 'young', manager: 'mid', lead: 'mid', exec: 'senior' };
const HAIR: Record<Look['gender'], Record<Age, HairStyle[]>> = {
  male: { young: ['shortCrop', 'sidePart'], mid: ['sidePart', 'shortCrop'], senior: ['sweptBack', 'sidePart'] },
  female: { young: ['ponytail', 'long', 'bob'], mid: ['lowBun', 'bob', 'long'], senior: ['lowBun', 'bob'] },
};
const PROP: Record<InterviewerConfig['role'], Prop> = { dev: 'laptop', hr: 'notebook', sales: 'cards', design: 'tablet', finance: 'folder', other: 'none' };

export function lookFor(cfg: InterviewerConfig, overrides: { skinTone?: string; hairStyle?: HairStyle } = {}): Look {
  const rnd = mulberry32(cfg.seed * 7919 + cfg.id.length);
  const gender: Look['gender'] = cfg.gender === 'none' ? (rnd() < 0.5 ? 'male' : 'female') : cfg.gender;
  const age = AGE[cfg.rank];
  const gray = age === 'senior' || (cfg.rank === 'lead' && rnd() < 0.3);

  // Formality falls with rank; the role picks the everyday outfit below executive level.
  let kind: OutfitKind;
  if (age === 'senior') kind = gender === 'male' ? 'suit' : 'blazer';
  else if (cfg.role === 'hr') kind = cfg.rank === 'staff' ? 'cardigan' : 'blazer';
  else if (cfg.role === 'dev') kind = cfg.rank === 'staff' ? 'shirt' : 'knit';
  else if (cfg.role === 'design') kind = 'turtleneck';
  else if (cfg.role === 'sales' || cfg.role === 'finance') kind = cfg.rank === 'staff' ? 'shirt' : 'suit';
  else kind = cfg.rank === 'lead' ? 'suit' : cfg.rank === 'manager' ? 'blazer' : 'shirt';
  if (kind === 'suit' && gender === 'female') kind = 'blazer';

  const color =
    kind === 'suit' ? pick(rnd, NAVY)
    : kind === 'blazer' ? (age === 'senior' || cfg.rank === 'lead' ? pick(rnd, NAVY) : pick(rnd, [SOFT.beige, SOFT.ivory, SOFT.sand]))
    : kind === 'shirt' ? pick(rnd, [SOFT.sky, '#dfe6f1', '#e8edf3'])
    : kind === 'knit' ? pick(rnd, [SOFT.sage, '#3c4658', SOFT.sand])
    : kind === 'cardigan' ? pick(rnd, [SOFT.lilac, SOFT.beige])
    : pick(rnd, ['#2f3442', '#4a4f5c']);
  const tie = kind === 'suit' && gender === 'male' ? pick(rnd, ['#2c3e66', '#4b2e5a', '#3d4a3a', '#5b2f2f']) : null;
  const glasses = age === 'senior' || cfg.personality === 'strict' || cfg.role === 'finance' ? (rnd() < 0.6 ? 'round' : 'rect') : rnd() < 0.15 ? 'rect' : null;

  return {
    gender,
    age,
    skin: overrides.skinTone ?? pick(rnd, SKIN_TONES.slice(0, 4)),
    hair: { style: overrides.hairStyle ?? pick(rnd, HAIR[gender][age]), color: gray ? pick(rnd, HAIR_GRAY) : pick(rnd, HAIR_DARK) },
    outfit: { kind, color, inner: kind === 'turtleneck' ? color : '#f7f8fa', tie },
    glasses,
    lanyard: cfg.rank === 'staff' && kind !== 'suit',
    prop: PROP[cfg.role],
    browBase: cfg.personality === 'pressure' ? -0.45 : cfg.personality === 'strict' ? -0.15 : 0.2,
  };
}
