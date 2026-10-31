import type { InterviewerConfig } from '../../shared/schema';

export type HairStyle = 'short' | 'side' | 'bob' | 'long' | 'bun' | 'bald';
export type OutfitKind = 'shirt' | 'tie' | 'jacket' | 'suit' | 'knit' | 'cardigan' | 'turtleneck';
export type Prop = 'laptop' | 'notebook' | 'cards' | 'tablet' | 'folder' | 'none';

export type Look = {
  skin: string;
  hair: { style: HairStyle; color: string };
  outfit: { kind: OutfitKind; color: string; accent: string };
  glasses: boolean;
  prop: Prop;
  ageGray: boolean;
  chair: 'normal' | 'large';
  idle: 'calm' | 'adjustGlasses' | 'armsCrossed';
  browBase: number;
};

export const SKIN_TONES = ['#f6d7c3', '#eec1a2', '#d9a27e', '#b97f5a', '#8d5524', '#5c3a21'];
const HAIR_COLORS = ['#1f1a17', '#2e221b', '#4a3426', '#6b4a2f'];
const GRAY = ['#9a9a9a', '#b5b5b5'];
const BRIGHT = ['#7fb3d5', '#a3d9a5', '#f7c873', '#f2a6a0', '#c3b1e1'];
const DARK = ['#2c3e50', '#34495e', '#3b3b4f', '#4a4a4a'];

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

const HAIR_SETS: Record<InterviewerConfig['gender'], HairStyle[]> = {
  male: ['short', 'side', 'short', 'side'],
  female: ['bob', 'long', 'bun', 'side'],
  none: ['short', 'side', 'bob', 'long', 'bun'],
};

const PROP: Record<InterviewerConfig['role'], Prop> = { dev: 'laptop', hr: 'notebook', sales: 'cards', design: 'tablet', finance: 'folder', other: 'none' };

export function lookFor(cfg: InterviewerConfig, overrides: { skinTone?: string; hairStyle?: HairStyle } = {}): Look {
  const rnd = mulberry32(cfg.seed * 7919 + cfg.id.length);
  const senior = cfg.rank === 'lead' || cfg.rank === 'exec';
  let style = pick(rnd, HAIR_SETS[cfg.gender]);
  if (cfg.gender === 'male' && senior && rnd() < 0.25) style = 'bald';
  const ageGray = cfg.rank === 'exec' || (cfg.rank === 'lead' && rnd() < 0.35);

  let kind: OutfitKind;
  if (cfg.rank === 'exec') kind = 'suit';
  else if (cfg.role === 'dev') kind = 'knit';
  else if (cfg.role === 'hr') kind = 'cardigan';
  else if (cfg.role === 'design') kind = 'turtleneck';
  else if (cfg.role === 'sales') kind = cfg.rank === 'staff' ? 'tie' : 'suit';
  else if (cfg.rank === 'lead') kind = 'jacket';
  else if (cfg.rank === 'manager') kind = 'tie';
  else kind = 'shirt';

  const darkOutfit = kind === 'suit' || kind === 'jacket' || cfg.rank === 'exec';
  const idle = cfg.personality === 'pressure' ? 'armsCrossed' : cfg.personality === 'strict' ? 'adjustGlasses' : 'calm';
  const glasses = cfg.personality === 'strict' || cfg.role === 'finance' || (senior && rnd() < 0.5);

  return {
    skin: overrides.skinTone ?? pick(rnd, SKIN_TONES.slice(0, 4)),
    hair: { style: overrides.hairStyle ?? style, color: ageGray ? pick(rnd, GRAY) : pick(rnd, HAIR_COLORS) },
    outfit: { kind, color: darkOutfit ? pick(rnd, DARK) : pick(rnd, BRIGHT), accent: pick(rnd, ['#c0392b', '#2471a3', '#7d3c98', '#1e8449']) },
    glasses,
    prop: PROP[cfg.role],
    ageGray,
    chair: cfg.rank === 'exec' ? 'large' : 'normal',
    idle,
    browBase: cfg.personality === 'pressure' ? -0.45 : cfg.personality === 'strict' ? -0.15 : 0.2,
  };
}
