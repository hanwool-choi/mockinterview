import type { InterviewerConfig } from '../../shared/schema';
import { AVATAR_STATES } from './expression';
import { Interviewer } from './Interviewer';
import { lookFor } from './look';

const LABEL: Record<(typeof AVATAR_STATES)[number], string> = { neutral: '기본', smile: '미소', serious: '진지', doubt: '의심', nod: '끄덕임', memo: '메모 중' };

const CAST: (InterviewerConfig & { name: string; title: string })[] = [
  { id: 'iv1', role: 'other', rank: 'exec', gender: 'male', personality: 'strict', seed: 11, name: '김도윤', title: '임원 (경영/전략)' },
  { id: 'iv2', role: 'hr', rank: 'manager', gender: 'female', personality: 'warm', seed: 23, name: '이서연', title: '인사 (HR)' },
  { id: 'iv3', role: 'dev', rank: 'staff', gender: 'male', personality: 'warm', seed: 37, name: '박준호', title: '실무 (직무/기술)' },
  { id: 'iv4', role: 'finance', rank: 'lead', gender: 'female', personality: 'pressure', seed: 41, name: '최지아', title: '재무 · 팀장' },
  { id: 'iv5', role: 'design', rank: 'staff', gender: 'female', personality: 'warm', seed: 52, name: '정하은', title: '디자인 · 사원' },
  { id: 'iv6', role: 'sales', rank: 'lead', gender: 'male', personality: 'pressure', seed: 64, name: '오성민', title: '영업 · 팀장' },
  { id: 'iv7', role: 'other', rank: 'exec', gender: 'female', personality: 'strict', seed: 77, name: '한미경', title: '임원' },
];

/** Dev/design review page at ?avatars: every state for a spread of roles, ranks and genders. */
export function Gallery() {
  return (
    <main className="avatar-gallery">
      <h1>면접관 캐릭터 시트</h1>
      <table>
        <thead>
          <tr>
            <th />
            {AVATAR_STATES.map((s) => (
              <th key={s}>{LABEL[s]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CAST.map((c) => (
            <tr key={c.id}>
              <th scope="row">
                <b>{c.name}</b>
                <small>{c.title}</small>
              </th>
              {AVATAR_STATES.map((s) => (
                <td key={s} data-state={s}>
                  <Interviewer look={lookFor(c)} state={s} live={false} size={150} seed={c.seed} title={`${c.name} ${LABEL[s]}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
