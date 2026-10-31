import {
  AmbientLight, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Group, HemisphereLight, Mesh, MeshBasicMaterial,
  PerspectiveCamera, PlaneGeometry, Scene, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import type { Expression, InterviewerConfig } from '../../shared/schema';
import { buildCharacter, nameplateTexture, toon, type CharacterRig } from './build';
import { faceTarget, lerpFace, nodPitch, type FaceState } from './expression';
import type { Look } from './look';

export type StageMember = { cfg: InterviewerConfig; look: Look; name: string; title: string };
type Action = 'write' | 'flip' | null;

type Actor = {
  id: string;
  rig: CharacterRig;
  look: Look;
  base: number;
  face: FaceState;
  target: FaceState;
  expr: Expression;
  exprUntil: number;
  nodStart: number;
  speaking: boolean;
  action: Action;
  blinkAt: number;
  blinkT: number;
  x: number;
};

export function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const HOLD_MS = 3200;

export class InterviewStage {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(36, 16 / 9, 0.1, 50);
  private actors: Actor[] = [];
  private raf = 0;
  private last = 0;
  private focusX = 0;
  private camTarget = new Vector3(0, 1.2, 0.2);
  private disposed = false;
  private ro?: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement, members: StageMember[], private opts: { lowPower: boolean; reducedMotion: boolean }) {
    this.renderer = new WebGLRenderer({ canvas, antialias: !opts.lowPower, alpha: false, powerPreference: opts.lowPower ? 'low-power' : 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1.5 : 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.scene.background = new Color('#e9eef3');
    this.buildRoom(members.length);
    const gap = members.length <= 2 ? 1.35 : 1.15;
    members.forEach((m, i) => {
      const rig = buildCharacter(m.look);
      const x = (i - (members.length - 1) / 2) * gap;
      rig.root.position.set(x, 0, 0);
      rig.root.rotation.y = -x * 0.08;
      this.scene.add(rig.root);
      this.addNameplate(m.name, m.title, x);
      const f = faceTarget('neutral', m.look.browBase);
      this.actors.push({ id: m.cfg.id, rig, look: m.look, base: m.look.browBase, face: f, target: f, expr: 'neutral', exprUntil: 0, nodStart: -1, speaking: false, action: null, blinkAt: performance.now() + 1500 + i * 700, blinkT: 0, x });
      this.poseArms(this.actors[this.actors.length - 1], 0);
    });
    this.camera.position.set(0, 1.78, 4.3);
    this.resize();
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
    }
    document.addEventListener('visibilitychange', this.onVis);
    this.loop(performance.now());
  }

  private buildRoom(n: number) {
    this.scene.add(new HemisphereLight('#ffffff', '#c9d2dc', 1.4));
    this.scene.add(new AmbientLight('#ffffff', 0.35));
    const key = new DirectionalLight('#ffffff', 1.6);
    key.position.set(2, 4, 5);
    this.scene.add(key);

    const floor = new Mesh(new PlaneGeometry(20, 20), toon('#cfd6de'));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    const wall = new Mesh(new PlaneGeometry(20, 8), toon('#f3f5f7'));
    wall.position.set(0, 4, -1.6);
    this.scene.add(wall);
    // windows
    for (let i = -2; i <= 2; i++) {
      const w = new Mesh(new PlaneGeometry(1.3, 1.5), new MeshBasicMaterial({ color: '#cfe6f7' }));
      w.position.set(i * 1.6, 2.35, -1.59);
      this.scene.add(w);
      const frame = new Mesh(new BoxGeometry(1.36, 0.04, 0.02), toon('#ffffff'));
      frame.position.set(i * 1.6, 2.35, -1.58);
      this.scene.add(frame);
    }
    // plant
    const plant = new Group();
    plant.add(new Mesh(new CylinderGeometry(0.18, 0.14, 0.4, 16), toon('#d8c3a5')).translateY(0.2));
    for (const [x, y, z, s] of [[0, 0.65, 0, 0.26], [0.14, 0.82, 0.05, 0.2], [-0.13, 0.78, -0.02, 0.22]]) {
      const leaf = new Mesh(new SphereGeometry(s, 14, 10), toon('#6aa86f'));
      leaf.position.set(x, y, z);
      plant.add(leaf);
    }
    plant.position.set(Math.max(2.2, n * 0.75 + 0.9), 0, -1.1);
    this.scene.add(plant);
    // table
    const width = Math.max(2.4, n * 1.3 + 0.6);
    const top = new Mesh(new BoxGeometry(width, 0.07, 0.95), toon('#8b6f52'));
    top.position.set(0, 0.78, 0.75);
    this.scene.add(top);
    const panel = new Mesh(new BoxGeometry(width - 0.05, 0.7, 0.04), toon('#7a5f45'));
    panel.position.set(0, 0.42, 1.2);
    this.scene.add(panel);
  }

  private addNameplate(name: string, title: string, x: number) {
    const tex = nameplateTexture(name, title);
    const plate = new Mesh(new BoxGeometry(0.5, 0.13, 0.03), [toon('#fbfaf7'), toon('#fbfaf7'), toon('#fbfaf7'), toon('#fbfaf7'), new MeshBasicMaterial({ map: tex }), toon('#fbfaf7')]);
    plate.position.set(x, 0.88, 1.12);
    plate.rotation.x = -0.25;
    this.scene.add(plate);
  }

  private resize = () => {
    const w = this.canvas.clientWidth || 640;
    const h = this.canvas.clientHeight || 360;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the whole panel in frame on narrow screens
    const n = this.actors.length || 1;
    const needW = Math.max(2.6, n * 1.3 + 0.4);
    const fovH = (2 * Math.atan((needW / 2) / 4.3) * 180) / Math.PI;
    const fovV = (2 * Math.atan(Math.tan((fovH * Math.PI) / 360) / this.camera.aspect) * 180) / Math.PI;
    this.camera.fov = Math.min(70, Math.max(32, fovV));
    this.camera.updateProjectionMatrix();
  };

  private onVis = () => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else {
      this.last = performance.now();
      this.loop(this.last);
    }
  };

  setExpression(id: string, expr: Expression) {
    const a = this.actors.find((x) => x.id === id);
    if (!a) return;
    a.expr = expr;
    a.target = faceTarget(expr, a.base);
    a.exprUntil = expr === 'neutral' ? 0 : performance.now() + HOLD_MS;
    if (expr === 'nod' && !this.opts.reducedMotion) a.nodStart = performance.now();
  }

  setSpeaking(id: string | null, on = true) {
    for (const a of this.actors) a.speaking = on && a.id === id;
  }

  setAction(id: string, action: Action) {
    const a = this.actors.find((x) => x.id === id);
    if (a) a.action = action;
  }

  focus(id: string | null) {
    const a = this.actors.find((x) => x.id === id);
    this.focusX = a ? a.x * 0.35 : 0;
  }

  private poseArms(a: Actor, t: number) {
    const { armL, armR } = a.rig;
    if (a.look.idle === 'armsCrossed' && a.action !== 'write') {
      armL.rotation.set(-1.35, 0, 1.05);
      armR.rotation.set(-1.45, 0, -1.05);
      return;
    }
    armL.rotation.set(-0.95, 0, -0.12);
    armR.rotation.set(-0.95, 0, 0.12);
    if (a.action === 'write') {
      armR.rotation.x = -1.05 + Math.sin(t * 9) * 0.05;
      armR.rotation.z = 0.05 + Math.sin(t * 13) * 0.04;
    } else if (a.action === 'flip') {
      armL.rotation.x = -1.1 + Math.max(0, Math.sin(t * 3)) * 0.35;
    } else if (a.look.idle === 'adjustGlasses' && a.look.glasses) {
      const phase = (t % 9) / 9;
      if (phase > 0.9) armR.rotation.set(-2.45, 0, 0.55);
    }
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const minDt = this.opts.lowPower ? 1000 / 30 : 0;
    if (now - this.last < minDt) return;
    const dt = Math.min(0.1, (now - this.last) / 1000 || 0.016);
    this.last = now;
    const t = now / 1000;
    const k = 1 - Math.exp(-dt * 8);

    for (const a of this.actors) {
      if (a.exprUntil && now > a.exprUntil) this.setExpression(a.id, 'neutral');
      a.face = lerpFace(a.face, a.target, k);
      // speech mouth
      const talk = a.speaking ? 0.25 + 0.55 * Math.abs(Math.sin(t * 11 + Math.sin(t * 3.7) * 2)) : 0;
      a.rig.setFace(a.face, talk);
      // blink
      if (now > a.blinkAt) {
        a.blinkT = 0.12;
        a.blinkAt = now + 2000 + Math.random() * 4000;
      }
      if (a.blinkT > 0) {
        a.blinkT -= dt;
        a.rig.setBlink(a.blinkT > 0.06 ? 0.15 : 0.5);
      } else a.rig.setBlink(1);
      // head
      const nod = a.nodStart >= 0 ? nodPitch((now - a.nodStart) / 1000) : 0;
      if (a.nodStart >= 0 && now - a.nodStart > 900) a.nodStart = -1;
      const motion = this.opts.reducedMotion ? 0 : 1;
      const speakerX = this.actors.find((x) => x.speaking)?.x;
      const lookYaw = speakerX !== undefined && speakerX !== a.x ? Math.sign(speakerX - a.x) * 0.35 : 0;
      a.rig.head.rotation.x = a.face.headPitch + nod + motion * Math.sin(t * 0.7 + a.x) * 0.015;
      a.rig.head.rotation.z = a.face.headRoll * (a.x <= 0 ? 1 : -1);
      a.rig.head.rotation.y += ((lookYaw - a.rig.head.rotation.y) * k) / 2;
      // breathing
      a.rig.torso.scale.y = 1 + motion * Math.sin(t * 1.6 + a.x) * 0.012;
      this.poseArms(a, t);
    }
    this.camera.position.x += (this.focusX - this.camera.position.x) * k * 0.5;
    this.camTarget.x = this.camera.position.x * 0.6;
    this.camera.lookAt(this.camTarget);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVis);
    this.ro?.disconnect();
    this.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as unknown;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat && typeof (mat as { dispose?: () => void }).dispose === 'function') (mat as { dispose: () => void }).dispose();
    });
    this.renderer.dispose();
  }
}
