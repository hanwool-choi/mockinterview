import type { Expression } from '../../shared/schema';

/** The six interviewer states. The model still speaks in Expression; stateFor maps it. */
export const AVATAR_STATES = ['neutral', 'smile', 'serious', 'doubt', 'nod', 'memo'] as const;
export type AvatarState = (typeof AVATAR_STATES)[number];

export function stateFor(e: Expression): AvatarState {
  return e === 'frown' ? 'serious' : e === 'tilt' ? 'doubt' : e;
}

/** Face parameters, kept small on purpose: changes should read as calm and professional. */
export type Face = {
  browL: number; // inner-end angle, −1 (down, stern) .. 1 (up, questioning)
  browR: number;
  browY: number; // −1..1 height
  eyeOpen: number; // 0..1 (lid)
  gazeY: number; // 0 ahead .. 1 down
  smile: number; // −0.4 (pressed down) .. 1
  tilt: number; // head roll, degrees
  pitch: number; // head pitch, degrees (down positive)
};

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

export function faceFor(state: AvatarState, base: number): Face {
  const n: Face = { browL: 0, browR: 0, browY: clamp(base * 0.5), eyeOpen: 1, gazeY: 0, smile: base > 0 ? 0.12 : 0, tilt: 0, pitch: 0 };
  switch (state) {
    case 'smile':
      return { ...n, browY: clamp(n.browY + 0.2), eyeOpen: 0.82, smile: 0.75 };
    case 'serious':
      return { ...n, browL: -0.45, browR: -0.45, browY: clamp(n.browY - 0.35), eyeOpen: 0.9, smile: -0.15, pitch: 1 };
    case 'doubt':
      return { ...n, browL: 0.55, browR: -0.25, browY: clamp(n.browY + 0.1), eyeOpen: 0.88, smile: -0.05, tilt: 4 };
    case 'nod':
      return { ...n, browY: clamp(n.browY + 0.12), eyeOpen: 0.9, smile: 0.35 };
    case 'memo':
      return { ...n, eyeOpen: 0.7, gazeY: 1, pitch: 5 };
    default:
      return n;
  }
}
