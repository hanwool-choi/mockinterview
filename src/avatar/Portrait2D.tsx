import type { AvatarState } from './expression';
import { Interviewer } from './Interviewer';
import type { Look } from './look';

/** Head-and-shoulders thumbnail in the same art style as the room. */
export function Portrait2D({ look, state = 'neutral', size = 56, title, seed = 0 }: { look: Look; state?: AvatarState; size?: number; title?: string; seed?: number }) {
  return (
    <span className="portrait2d" style={{ width: size, height: size }}>
      <Interviewer look={look} state={state} crop="head" size={size} title={title} live={false} seed={seed} />
    </span>
  );
}
