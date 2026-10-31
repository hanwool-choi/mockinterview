import {
  BoxGeometry, CanvasTexture, CapsuleGeometry, CircleGeometry, Color, CylinderGeometry, DataTexture, Group, Mesh,
  MeshBasicMaterial, MeshToonMaterial, NearestFilter, RedFormat, SphereGeometry, TorusGeometry, type Material, type Object3D,
} from 'three';
import type { FaceState } from './expression';
import type { Look } from './look';

let gradient: DataTexture | null = null;
function toonGradient(): DataTexture {
  if (gradient) return gradient;
  gradient = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat);
  gradient.minFilter = NearestFilter;
  gradient.magFilter = NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

export const toon = (color: string | number) => new MeshToonMaterial({ color: new Color(color), gradientMap: toonGradient() });
const flat = (color: string | number, opacity = 1) => new MeshBasicMaterial({ color: new Color(color), transparent: opacity < 1, opacity });

function mesh(geo: ConstructorParameters<typeof Mesh>[0], mat: Material, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

const shade = (hex: string, k: number) => {
  const c = new Color(hex);
  c.multiplyScalar(k);
  return c;
};

export type CharacterRig = {
  root: Group;
  head: Group;
  torso: Mesh;
  armL: Group;
  armR: Group;
  setFace(f: FaceState, mouthOpen: number): void;
  setBlink(open: number): void;
};

const HEAD_R = 0.3;

function buildHair(look: Look): Object3D[] {
  const mat = toon(look.hair.color);
  const out: Object3D[] = [];
  const cap = (scale = 1.06, thetaLen = Math.PI * 0.55) => {
    const m = mesh(new SphereGeometry(HEAD_R * scale, 24, 16, 0, Math.PI * 2, 0, thetaLen), mat);
    m.rotation.x = -0.25;
    return m;
  };
  switch (look.hair.style) {
    case 'bald': {
      const side = mesh(new TorusGeometry(HEAD_R * 0.98, 0.05, 6, 20, Math.PI * 1.2), mat, 0, -0.02, -0.02);
      side.rotation.set(Math.PI / 2 - 0.2, 0, Math.PI * 0.9);
      out.push(side);
      break;
    }
    case 'short':
      out.push(cap(1.07, Math.PI * 0.5));
      break;
    case 'side': {
      out.push(cap(1.07, Math.PI * 0.52));
      const sweep = mesh(new SphereGeometry(0.16, 16, 10), mat, -0.12, 0.2, 0.17);
      sweep.scale.set(1.4, 0.5, 0.7);
      sweep.rotation.z = 0.35;
      out.push(sweep);
      break;
    }
    case 'bob': {
      out.push(cap(1.09, Math.PI * 0.55));
      const back = mesh(new CylinderGeometry(HEAD_R * 1.08, HEAD_R * 1.12, 0.36, 24, 1, true, Math.PI * 0.6, Math.PI * 1.8), mat, 0, -0.04, -0.01);
      back.rotation.y = 0;
      out.push(back);
      break;
    }
    case 'long': {
      out.push(cap(1.09, Math.PI * 0.55));
      const back = mesh(new BoxGeometry(0.56, 0.62, 0.16), mat, 0, -0.18, -0.2);
      out.push(back);
      const l = mesh(new BoxGeometry(0.1, 0.42, 0.14), mat, -0.29, -0.12, 0.02);
      const r = mesh(new BoxGeometry(0.1, 0.42, 0.14), mat, 0.29, -0.12, 0.02);
      out.push(l, r);
      break;
    }
    case 'bun': {
      out.push(cap(1.07, Math.PI * 0.52));
      out.push(mesh(new SphereGeometry(0.12, 16, 12), mat, 0, 0.26, -0.2));
      break;
    }
  }
  return out;
}

function buildGlasses(): Group {
  const g = new Group();
  const mat = flat('#222');
  const ringGeo = new TorusGeometry(0.065, 0.011, 6, 20);
  g.add(mesh(ringGeo, mat, -0.1, 0, 0), mesh(ringGeo, mat, 0.1, 0, 0), mesh(new BoxGeometry(0.07, 0.012, 0.012), mat, 0, 0.01, 0));
  return g;
}

export function nameplateTexture(name: string, title: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#20232a';
  ctx.textAlign = 'center';
  ctx.font = '700 52px "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.fillText(name, 256, 62);
  ctx.fillStyle = '#6b7280';
  ctx.font = '500 32px "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  ctx.fillText(title, 256, 108);
  const t = new CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

function buildProp(kind: Look['prop']): Group {
  const g = new Group();
  switch (kind) {
    case 'laptop': {
      g.add(mesh(new BoxGeometry(0.42, 0.02, 0.28), toon('#b8bec7'), 0, 0.01, 0));
      const lid = mesh(new BoxGeometry(0.42, 0.28, 0.015), toon('#9aa1ab'), 0, 0.14, -0.14);
      lid.rotation.x = -0.25;
      g.add(lid);
      break;
    }
    case 'notebook':
      g.add(mesh(new BoxGeometry(0.28, 0.02, 0.36), toon('#fdfdfb'), 0, 0.01, 0));
      g.add(mesh(new CylinderGeometry(0.008, 0.008, 0.2, 6), toon('#2b4c7e'), 0.18, 0.02, 0).rotateZ(Math.PI / 2).rotateY(0.6));
      break;
    case 'cards':
      for (let i = 0; i < 3; i++) g.add(mesh(new BoxGeometry(0.12, 0.006, 0.07), toon('#ffffff'), -0.08 + i * 0.08, 0.004 + i * 0.006, 0));
      break;
    case 'tablet':
      g.add(mesh(new BoxGeometry(0.3, 0.015, 0.22), toon('#30343b'), 0, 0.008, 0));
      g.add(mesh(new BoxGeometry(0.27, 0.002, 0.19), flat('#7fb3d5'), 0, 0.017, 0));
      break;
    case 'folder':
      g.add(mesh(new BoxGeometry(0.3, 0.03, 0.38), toon('#e8b04b'), 0, 0.015, 0));
      break;
    default:
      g.add(mesh(new CylinderGeometry(0.045, 0.04, 0.11, 14), toon('#ffffff'), 0.1, 0.055, 0));
  }
  return g;
}

export function buildCharacter(look: Look): CharacterRig {
  const root = new Group();
  const skin = toon(look.skin);

  // chair
  const chairH = look.chair === 'large' ? 1.25 : 0.95;
  root.add(mesh(new BoxGeometry(look.chair === 'large' ? 0.86 : 0.7, chairH, 0.1), toon('#3d4451'), 0, 0.45 + chairH / 2, -0.32));

  // torso
  const torso = mesh(new CapsuleGeometry(0.27, 0.42, 6, 18), toon(look.outfit.color), 0, 0.98, 0);
  torso.scale.set(1.12, 1, 0.78);
  root.add(torso);
  const front = new Group();
  front.position.set(0, 1.08, 0.2);
  const k = look.outfit.kind;
  if (k === 'suit' || k === 'jacket' || k === 'tie') {
    const shirt = mesh(new BoxGeometry(0.16, 0.34, 0.02), toon('#f4f6f8'), 0, 0, 0);
    if (k !== 'tie') shirt.scale.x = 0.9;
    front.add(shirt);
    if (k === 'suit' || k === 'tie') front.add(mesh(new BoxGeometry(0.05, 0.28, 0.025), toon(look.outfit.accent), 0, -0.03, 0.01));
  } else if (k === 'turtleneck') {
    root.add(mesh(new CylinderGeometry(0.12, 0.13, 0.12, 16), toon(look.outfit.color), 0, 1.33, 0));
  } else if (k === 'cardigan') {
    front.add(mesh(new BoxGeometry(0.14, 0.38, 0.02), toon('#f2efe6'), 0, 0, 0));
  } else if (k === 'knit') {
    front.add(mesh(new BoxGeometry(0.42, 0.03, 0.02), toon(shade(look.outfit.color, 0.8).getStyle()), 0, 0.12, 0));
  }
  root.add(front);

  // arms (shoulder pivots)
  const mkArm = (side: -1 | 1) => {
    const pivot = new Group();
    pivot.position.set(0.33 * side, 1.18, 0);
    const upper = mesh(new CapsuleGeometry(0.075, 0.3, 4, 10), toon(look.outfit.color), 0, -0.2, 0);
    const hand = mesh(new SphereGeometry(0.07, 12, 10), skin, 0, -0.42, 0);
    pivot.add(upper, hand);
    return pivot;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  root.add(armL, armR);

  // head
  const head = new Group();
  head.position.set(0, 1.58, 0);
  head.add(mesh(new CylinderGeometry(0.08, 0.09, 0.14, 12), skin, 0, -0.3, 0));
  const skull = mesh(new SphereGeometry(HEAD_R, 32, 24), skin);
  skull.scale.set(1, 1.04, 0.96);
  head.add(skull);
  head.add(mesh(new SphereGeometry(0.06, 12, 10), skin, -HEAD_R, -0.02, 0), mesh(new SphereGeometry(0.06, 12, 10), skin, HEAD_R, -0.02, 0));
  head.add(mesh(new SphereGeometry(0.035, 12, 10), toon(shade(look.skin, 0.92).getStyle()), 0, -0.04, HEAD_R * 0.97));
  for (const h of buildHair(look)) head.add(h);

  const face = new Group();
  face.position.set(0, 0, HEAD_R * 0.93);
  head.add(face);
  const eyeGeo = new SphereGeometry(0.034, 14, 10);
  const eyeMat = flat('#1d1d1f');
  const eyeL = mesh(eyeGeo, eyeMat, -0.1, 0.03, 0.02);
  const eyeR = mesh(eyeGeo, eyeMat, 0.1, 0.03, 0.02);
  const shine = new SphereGeometry(0.009, 6, 6);
  eyeL.add(mesh(shine, flat('#ffffff'), 0.01, 0.012, 0.03));
  eyeR.add(mesh(shine, flat('#ffffff'), 0.01, 0.012, 0.03));
  face.add(eyeL, eyeR);

  const browMat = toon(look.ageGray ? '#8a8a8a' : look.hair.color);
  const browGeo = new BoxGeometry(0.09, 0.018, 0.02);
  const browL = mesh(browGeo, browMat, -0.1, 0.11, 0.03);
  const browR = mesh(browGeo, browMat, 0.1, 0.11, 0.03);
  face.add(browL, browR);

  const mouthCurve = mesh(new TorusGeometry(0.06, 0.011, 6, 18, Math.PI), flat('#7a3b3b'), 0, -0.1, 0.02);
  mouthCurve.rotation.z = Math.PI; // U shape (smile) when scale.y > 0
  const mouthOpen = mesh(new CircleGeometry(0.045, 20), flat('#5a2328'), 0, -0.13, 0.025);
  face.add(mouthCurve, mouthOpen);

  const blushGeo = new CircleGeometry(0.04, 16);
  const blushL = mesh(blushGeo, flat('#ff8a8a', 0), -0.17, -0.05, 0.0);
  const blushR = mesh(blushGeo, flat('#ff8a8a', 0), 0.17, -0.05, 0.0);
  blushL.rotation.y = -0.45;
  blushR.rotation.y = 0.45;
  face.add(blushL, blushR);

  if (look.glasses) {
    const gl = buildGlasses();
    gl.position.set(0, 0.03, 0.05);
    face.add(gl);
  }

  root.add(head);

  // prop on the table in front
  const prop = buildProp(look.prop);
  prop.position.set(0.05, 0.8, 0.62);
  root.add(prop);

  let blink = 1;
  let lastFace: FaceState | null = null;
  let lastOpen = 0;
  const apply = () => {
    const f = lastFace;
    if (!f) return;
    browL.position.y = 0.11 + f.browY * 0.035;
    browR.position.y = 0.11 + f.browY * 0.035;
    browL.rotation.z = -f.browL * 0.45;
    browR.rotation.z = f.browR * 0.45;
    const eo = Math.max(0.08, f.eyeOpen * blink);
    eyeL.scale.y = eo;
    eyeR.scale.y = eo;
    const curve = f.mouth.smile - f.mouth.pout;
    const sign = curve >= 0 ? 1 : -1;
    mouthCurve.scale.set(1 - f.mouth.pout * 0.25, sign * Math.max(0.18, Math.abs(curve)), 1);
    mouthCurve.position.y = -0.1 + (sign < 0 ? -0.03 : 0);
    const open = Math.max(f.mouth.open, lastOpen);
    mouthOpen.visible = open > 0.04;
    mouthOpen.scale.set(0.8 + open * 0.2, open, 1);
    (blushL.material as MeshBasicMaterial).opacity = f.blush * 0.55;
    (blushR.material as MeshBasicMaterial).opacity = f.blush * 0.55;
  };

  return {
    root, head, torso, armL, armR,
    setFace(f, open) {
      lastFace = f;
      lastOpen = open;
      apply();
    },
    setBlink(open) {
      blink = open;
      apply();
    },
  };
}
