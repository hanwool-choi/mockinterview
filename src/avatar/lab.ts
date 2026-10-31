// Dev-only visual check for the 3D panel (not part of the production build).
import { lookFor } from './look';
import { InterviewStage } from './stage';
import type { Expression, InterviewerConfig } from '../../shared/schema';

const q = new URLSearchParams(location.search);
const all: InterviewerConfig[] = [
  { id: 'a', role: 'hr', rank: 'manager', gender: 'female', personality: 'warm', seed: 3 },
  { id: 'b', role: 'dev', rank: 'staff', gender: 'male', personality: 'strict', seed: 5 },
  { id: 'c', role: 'other', rank: 'exec', gender: 'male', personality: 'pressure', seed: 9 },
  { id: 'd', role: 'design', rank: 'lead', gender: 'female', personality: 'warm', seed: 11 },
];
const cfgs = all.slice(0, Number(q.get("n") ?? 4));
const stage = new InterviewStage(document.getElementById('c') as HTMLCanvasElement, cfgs.map((c, i) => ({ cfg: c, look: lookFor(c), name: ['이서연', '박준호', '김도윤', '최지아'][i], title: ['인사 과장', '개발 사원', '상무', '디자인 팀장'][i] })), { lowPower: false, reducedMotion: false });
const exprs = (q.get('e') ?? 'smile,tilt,frown,nod').split(',') as Expression[];
setTimeout(() => cfgs.forEach((c, i) => stage.setExpression(c.id, exprs[i % exprs.length])), 300);
if (q.get('speak')) stage.setSpeaking(q.get('speak'));
(window as unknown as { __ready: boolean }).__ready = true;
