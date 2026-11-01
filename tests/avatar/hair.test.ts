import { describe, it, expect } from 'vitest';
import { Group, Mesh, Vector3 } from 'three';
import { buildHair } from '../../src/avatar/build';
import type { HairStyle, Look } from '../../src/avatar/look';

const STYLES: HairStyle[] = ['short', 'side', 'bob', 'long', 'bun', 'bald'];
const look = (style: HairStyle): Look => ({
  skin: '#eec1a2', hair: { style, color: '#2e221b' }, outfit: { kind: 'shirt', color: '#fff', accent: '#000' },
  glasses: false, prop: 'none', ageGray: false, chair: 'normal', idle: 'calm', browBase: 0,
});

/** Hair vertices in head space that sit in front of the face, inside the eye–mouth window. */
function vertsCoveringFace(style: HairStyle): number {
  const head = new Group();
  for (const h of buildHair(look(style))) head.add(h);
  head.updateMatrixWorld(true);
  let n = 0;
  const v = new Vector3();
  head.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      // face window: eyes y≈0.03, mouth y≈-0.13, cheeks |x|<0.2, front of head z>0.15
      if (v.z > 0.15 && Math.abs(v.x) < 0.2 && v.y < 0.08 && v.y > -0.2) n++;
    }
  });
  return n;
}

describe('hair never covers the face', () => {
  for (const style of STYLES) {
    it(`${style}`, () => expect(vertsCoveringFace(style)).toBe(0));
  }
});
