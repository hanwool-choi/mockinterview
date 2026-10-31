import type { Expression } from '../../shared/schema';

export type FaceState = {
  browL: number; // rotation-ish, −1..1 (positive = inner end raised)
  browR: number;
  browY: number; // −1..1 height offset
  eyeOpen: number; // 0..1
  mouth: { smile: number; open: number; pout: number }; // 0..1
  headPitch: number; // radians offset (nod handled separately)
  headRoll: number;
  blush: number; // 0..1
};

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

export function faceTarget(expr: Expression, base: number): FaceState {
  const n: FaceState = { browL: 0, browR: 0, browY: clamp(base * 0.6), eyeOpen: 1, mouth: { smile: base > 0 ? 0.2 : 0.05, open: 0, pout: 0 }, headPitch: 0, headRoll: 0, blush: 0 };
  switch (expr) {
    case 'smile':
      return { ...n, browY: clamp(n.browY + 0.3), eyeOpen: 0.55, mouth: { smile: 0.95, open: 0.15, pout: 0 }, blush: 0.6 };
    case 'nod':
      return { ...n, browY: clamp(n.browY + 0.15), eyeOpen: 0.85, mouth: { smile: 0.45, open: 0, pout: 0 } };
    case 'tilt':
      return { ...n, browL: 0.5, browR: -0.3, browY: clamp(n.browY + 0.1), eyeOpen: 0.95, mouth: { smile: 0, open: 0.05, pout: 0.2 }, headRoll: 0.26 };
    case 'frown':
      return { ...n, browL: -0.6, browR: -0.6, browY: clamp(n.browY - 0.5), eyeOpen: 0.7, mouth: { smile: 0, open: 0, pout: 0.75 }, headPitch: 0.05 };
    default:
      return n;
  }
}

const NOD_DUR = 0.9;
export function nodPitch(tSec: number): number {
  if (tSec <= 0 || tSec >= NOD_DUR) return 0;
  const env = Math.sin((Math.PI * tSec) / NOD_DUR);
  return 0.22 * env * Math.sin((2 * Math.PI * 2.5 * tSec) / NOD_DUR);
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function lerpFace(a: FaceState, b: FaceState, t: number): FaceState {
  return {
    browL: mix(a.browL, b.browL, t), browR: mix(a.browR, b.browR, t), browY: mix(a.browY, b.browY, t), eyeOpen: mix(a.eyeOpen, b.eyeOpen, t),
    mouth: { smile: mix(a.mouth.smile, b.mouth.smile, t), open: mix(a.mouth.open, b.mouth.open, t), pout: mix(a.mouth.pout, b.mouth.pout, t) },
    headPitch: mix(a.headPitch, b.headPitch, t), headRoll: mix(a.headRoll, b.headRoll, t), blush: mix(a.blush, b.blush, t),
  };
}
