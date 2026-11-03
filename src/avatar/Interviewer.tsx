import { useEffect, useState, type CSSProperties } from 'react';
import { faceFor, type AvatarState } from './expression';
import type { Look } from './look';

/** Mix a hex colour toward black (amt > 0) or white (amt < 0). */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(amt >= 0 ? v * (1 - amt) : v + (255 - v) * -amt);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(ch);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

type Props = {
  look: Look;
  state?: AvatarState;
  speaking?: boolean;
  /** 'bust' for the interview room, 'head' for thumbnails. */
  crop?: 'bust' | 'head';
  size?: number;
  title?: string;
  /** Idle motion (blink, breathing). Off for thumbnails and reduced motion. */
  live?: boolean;
  seed?: number;
};

const MOUTH_OPEN = [0, 2.6, 5.2]; // closed → slightly open → open

/** Semi-realistic flat 2D interviewer: one art style, six states, calm motion. */
export function Interviewer({ look, state = 'neutral', speaking = false, crop = 'bust', size = 220, title, live = true, seed = 0 }: Props) {
  const f = faceFor(state, look.browBase);
  const [mouthStage, setMouthStage] = useState(0);

  // Speech: the mouth moves through three shapes every 0.2–0.4s.
  useEffect(() => {
    if (!speaking || !live) return setMouthStage(0);
    let t = 0;
    const tick = () => {
      setMouthStage((s) => (s === 0 ? 1 + Math.round(Math.random()) : Math.random() < 0.45 ? 0 : s === 1 ? 2 : 1));
      t = window.setTimeout(tick, 200 + Math.random() * 180);
    };
    tick();
    return () => window.clearTimeout(t);
  }, [speaking, live]);

  const skin = look.skin;
  const skinShade = shade(skin, 0.12);
  const line = '#2a2420';
  const hair = look.hair.color;
  const brow = look.age === 'senior' ? shade(hair, 0.25) : shade(hair, 0.1);
  const lip = shade(skin, 0.32);
  const female = look.gender === 'female';
  const open = speaking ? MOUTH_OPEN[mouthStage] : f.smile > 0.5 ? 2.4 : 0;
  const lidY = 84.5 + (1 - f.eyeOpen) * 8.5;
  const gaze = f.gazeY * 2.2;
  const mouthY = 121;
  const corner = mouthY - f.smile * 3.4;
  const mid = mouthY + f.smile * 3.4;

  const face = female
    ? 'M66 84 C66 57 81 47 100 47 C119 47 134 57 134 84 C134 102 130 114 121 123 C114 131 107 134 100 134 C93 134 86 131 79 123 C70 114 66 102 66 84 Z'
    : 'M64 84 C64 56 80 46 100 46 C120 46 136 56 136 84 C136 103 132 116 123 125 C115 133 108 136 100 136 C92 136 85 133 77 125 C68 116 64 103 64 84 Z';

  const viewBox = crop === 'head' ? '46 26 108 116' : '4 22 192 198';
  const style = { '--blink': `${4.2 + (seed % 5) * 0.45}s`, '--blink-delay': `${(seed % 7) * 0.6}s`, '--breath-delay': `${(seed % 3) * 0.7}s` } as CSSProperties;

  return (
    <svg viewBox={viewBox} width={size} height={crop === 'head' ? size * 1.07 : size * 1.03} role="img" aria-label={title} className={`interviewer ${live ? 'live' : ''} state-${state}`} style={style}>
      <g className="breath">
        {/* back hair */}
        {look.hair.style === 'long' && <path d="M60 94 C56 58 78 34 100 34 C122 34 144 58 140 94 L144 160 C136 168 126 168 120 160 L126 112 L74 112 L80 160 C74 168 64 168 56 160 Z" fill={hair} />}
        {look.hair.style === 'bob' && <path d="M60 96 C56 58 78 34 100 34 C122 34 144 58 140 96 C142 114 138 126 130 132 L124 112 L76 112 L70 132 C62 126 58 114 60 96 Z" fill={hair} />}
        {(look.hair.style === 'lowBun' || look.hair.style === 'ponytail') && <path d="M62 96 C56 60 76 34 100 34 C124 34 144 60 138 96 C138 108 134 116 128 118 L130 92 L70 92 L72 118 C66 116 62 108 62 96 Z" fill={hair} />}

        {/* neck */}
        <path d="M86 118 L86 148 Q100 154 114 148 L114 118 Z" fill={skin} />
        <path d="M86 126 Q100 138 114 126 L114 136 Q100 146 86 136 Z" fill={skinShade} />

        <Outfit look={look} />

        {/* head: static tilt/pitch from the state, nod motion inside */}
        <g transform={`rotate(${f.tilt} 100 140) translate(0 ${f.pitch * 0.7})`}>
          <g className={state === 'nod' && live ? 'nod' : ''}>
            <ellipse cx="63.5" cy="94" rx="5" ry="9.5" fill={skin} />
            <ellipse cx="136.5" cy="94" rx="5" ry="9.5" fill={skin} />
            <path d={face} fill={skin} />
            <path d="M121 60 C130 70 131 92 128 106 C125 117 119 126 112 132 C118 120 122 104 121 88 C120 76 118 66 121 60 Z" fill={skinShade} opacity="0.3" />
            {look.age === 'senior' && (
              <g stroke={skinShade} strokeWidth="1.1" fill="none" strokeLinecap="round">
                <path d="M89 110 C86 116 87 121 90 124" />
                <path d="M111 110 C114 116 113 121 110 124" />
                <path d="M89 63 Q100 60 111 63" opacity="0.6" />
              </g>
            )}
            {look.age === 'mid' && <path d="M90 112 C88 117 89 121 91 123 M110 112 C112 117 111 121 109 123" stroke={skinShade} strokeWidth="0.9" fill="none" opacity="0.6" />}

            <Hair look={look} />

            {/* brows */}
            <g transform={`translate(0 ${-f.browY * 3.4})`}>
              <path transform={`rotate(${-f.browL * 13} 85 80)`} d="M76 81.5 Q84 76.5 94 79 L94 81.4 Q84 79.4 76 83.2 Z" fill={brow} />
              <path transform={`rotate(${f.browR * 13} 115 80)`} d="M124 81.5 Q116 76.5 106 79 L106 81.4 Q116 79.4 124 83.2 Z" fill={brow} />
            </g>

            {/* eyes */}
            {[86, 114].map((cx) => (
              <g key={cx}>
                <path d={`M${cx - 8} 92 Q${cx} 85.5 ${cx + 8} 92 Q${cx} 96.5 ${cx - 8} 92 Z`} fill="#fbfbfa" />
                <clipPath id={`eye-${cx}-${seed}`}>
                  <path d={`M${cx - 8} 92 Q${cx} 85.5 ${cx + 8} 92 Q${cx} 96.5 ${cx - 8} 92 Z`} />
                </clipPath>
                <g clipPath={`url(#eye-${cx}-${seed})`}>
                  <circle cx={cx} cy={91.4 + gaze} r="3.6" fill="#3a2a22" />
                  <circle cx={cx} cy={91.4 + gaze} r="1.7" fill="#120d0b" />
                  <circle cx={cx + 1.1} cy={90.2 + gaze} r="0.8" fill="#fff" />
                  {/* resting lid from eyeOpen */}
                  <path d={`M${cx - 9} 84 L${cx + 9} 84 L${cx + 9} 92 Q${cx} ${lidY} ${cx - 9} 92 Z`} fill={skin} />
                </g>
                <path d={`M${cx - 8.4} 92.2 Q${cx} ${Math.min(lidY, 92) - 0.3} ${cx + 8.4} 91.8`} stroke={line} strokeWidth="1.7" fill="none" strokeLinecap="round" />
                <path d={`M${cx - 6} ${94.6 - Math.max(0, f.smile) * 1.2} Q${cx} ${96.8 - Math.max(0, f.smile) * 2.6} ${cx + 6} ${94.6 - Math.max(0, f.smile) * 1.2}`} stroke={skinShade} strokeWidth={0.8 + Math.max(0, f.smile) * 0.5} fill="none" />
                {/* blink lid */}
                <path className="lid" d={`M${cx - 9} 85 Q${cx} 83 ${cx + 9} 85 L${cx + 9} 93 Q${cx} 96 ${cx - 9} 93 Z`} fill={skin} />
              </g>
            ))}

            {look.glasses === 'round' && (
              <g stroke="#2b2f3a" strokeWidth="1.5" fill="#ffffff" fillOpacity="0.06">
                <circle cx="86" cy="91" r="9.2" />
                <circle cx="114" cy="91" r="9.2" />
                <path d="M95.2 90 Q100 88 104.8 90 M76.8 89 L68 87.5 M123.2 89 L132 87.5" fill="none" />
              </g>
            )}
            {look.glasses === 'rect' && (
              <g stroke="#2b2f3a" strokeWidth="1.5" fill="#ffffff" fillOpacity="0.06">
                <rect x="76.5" y="85" width="19" height="13" rx="4" />
                <rect x="104.5" y="85" width="19" height="13" rx="4" />
                <path d="M95.5 90 Q100 88.5 104.5 90 M76.5 89 L68 87.5 M123.5 89 L132 87.5" fill="none" />
              </g>
            )}

            {f.smile > 0.5 && <path d="M86 110 C84 114 85 118 87 121 M114 110 C116 114 115 118 113 121" stroke={skinShade} strokeWidth="1" fill="none" opacity="0.7" />}
            {/* nose */}
            <path d="M100 91 C99.2 100 97.4 105.5 96.2 108.6 C98.2 110.8 101.8 110.8 103.8 108.6" stroke={skinShade} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* mouth */}
            {open > 0.3 && (
              <g>
                <path d={`M91 ${corner} Q100 ${mid - 1} 109 ${corner} Q100 ${mid + open * 1.7} 91 ${corner} Z`} fill="#5a2b2d" />
                {open > 2 && <path d={`M93.5 ${corner + 0.6} Q100 ${mid - 0.3} 106.5 ${corner + 0.6} L106 ${corner + 1.8} Q100 ${mid + 1} 94 ${corner + 1.8} Z`} fill="#f3f1ee" />}
              </g>
            )}
            <path d={`M91 ${corner} Q100 ${mid} 109 ${corner}`} stroke={lip} strokeWidth="1.9" fill="none" strokeLinecap="round" />
            <path d={`M95.5 ${mid + 3.6 + open * 1.2} Q100 ${mid + 5.2 + open * 1.2} 104.5 ${mid + 3.6 + open * 1.2}`} stroke={skinShade} strokeWidth="1" fill="none" opacity="0.7" />
          </g>
        </g>

        <Hands look={look} memo={state === 'memo'} />
      </g>
    </svg>
  );
}

function Hair({ look }: { look: Look }) {
  const c = look.hair.color;
  const s = shade(c, 0.18);
  const hl = shade(c, -0.18);
  switch (look.hair.style) {
    case 'shortCrop':
      return (
        <g>
          <path d="M62 88 C58 58 76 34 100 34 C124 34 142 58 138 88 L135 88 C134 74 130 66 124 62 C114 58 104 60 96 58 C86 56 76 62 70 70 C67 76 66 82 65 88 Z" fill={c} />
          <path d="M78 44 Q100 36 124 46" stroke={hl} strokeWidth="1.4" fill="none" opacity="0.5" />
        </g>
      );
    case 'sidePart':
      return (
        <g>
          <path d="M62 90 C56 56 78 32 102 32 C126 32 144 54 138 90 L135 90 C135 74 130 64 122 60 C110 56 96 64 84 60 C76 58 69 70 66 90 Z" fill={c} />
          <path d="M84 40 Q90 50 85 60" stroke={s} strokeWidth="1.3" fill="none" />
          <path d="M94 40 Q114 36 128 50" stroke={hl} strokeWidth="1.4" fill="none" opacity="0.5" />
        </g>
      );
    case 'sweptBack':
      return (
        <g>
          <path d="M63 88 C60 58 78 36 100 36 C122 36 140 58 137 88 L134 86 C133 70 126 60 112 56 C100 53 86 55 78 61 C71 67 67 76 66 86 Z" fill={c} />
          <path d="M80 48 Q100 41 120 48 M76 55 Q100 47 124 54" stroke={s} strokeWidth="1" fill="none" opacity="0.7" />
        </g>
      );
    case 'lowBun':
    case 'ponytail':
      return (
        <g>
          <path d="M64 92 C60 58 78 36 100 36 C122 36 140 58 136 92 L132 90 C130 70 122 60 108 56 C98 60 88 62 80 68 C72 74 68 82 68 92 Z" fill={c} />
          <path d="M108 40 Q100 48 98 58" stroke={s} strokeWidth="1.2" fill="none" />
          <path d="M112 44 Q126 52 130 66" stroke={hl} strokeWidth="1.4" fill="none" opacity="0.45" />
        </g>
      );
    case 'bob':
      return <path d="M66 90 C64 60 82 42 102 42 C122 42 136 58 134 86 C124 66 108 60 92 66 C80 70 70 80 66 90 Z" fill={c} />;
    case 'long':
      return (
        <g>
          <path d="M66 92 C62 60 80 40 100 40 C120 40 138 60 134 92 C128 72 116 58 102 52 L98 52 C84 58 72 72 66 92 Z" fill={c} />
          <path d="M100 41 L100 52" stroke={s} strokeWidth="1.2" />
        </g>
      );
  }
}

function Outfit({ look }: { look: Look }) {
  const { kind, color, inner, tie } = look.outfit;
  const dark = shade(color, 0.16);
  const body = 'M10 220 C12 180 36 158 80 150 L100 156 L120 150 C164 158 188 180 190 220 Z';
  const sideShade = <path d="M156 162 C176 174 188 194 190 220 L170 220 C167 197 158 180 144 168 Z" fill={dark} opacity="0.45" />;
  return (
    <g>
      <path d={body} fill={color} />
      {sideShade}
      {(kind === 'suit' || kind === 'blazer' || kind === 'cardigan') && (
        <g>
          <path d="M84 150 L100 186 L116 150 Z" fill={inner} />
          {kind !== 'cardigan' && (
            <g fill={dark}>
              <path d="M82 151 L100 188 L92 196 L74 160 Z" />
              <path d="M118 151 L100 188 L108 196 L126 160 Z" />
            </g>
          )}
          {tie && (
            <g fill={tie}>
              <path d="M96.5 152 L103.5 152 L102 159 L98 159 Z" />
              <path d="M97.6 159 L102.4 159 L104.6 186 L100 192 L95.4 186 Z" />
            </g>
          )}
          {!tie && <path d="M88 151 L100 166 L112 151" stroke={shade(inner, 0.1)} strokeWidth="1.2" fill="none" />}
        </g>
      )}
      {kind === 'shirt' && (
        <g>
          <path d="M86 149 L100 162 L92 168 L81 155 Z M114 149 L100 162 L108 168 L119 155 Z" fill={shade(color, -0.35)} stroke={dark} strokeWidth="0.8" />
          <path d="M100 162 L100 220" stroke={dark} strokeWidth="1" />
        </g>
      )}
      {kind === 'knit' && <path d="M84 150 Q100 168 116 150 Q100 160 84 150 Z" fill={inner} />}
      {kind === 'turtleneck' && (
        <g>
          <path d="M86 128 L114 128 L116 152 Q100 158 84 152 Z" fill={color} />
          <path d="M87 136 L113 136 M86 144 L114 144" stroke={dark} strokeWidth="1" />
        </g>
      )}
      {look.lanyard && (
        <g>
          <path d="M86 152 L96 196 M114 152 L104 196" stroke="#2f3a56" strokeWidth="1.8" fill="none" />
          <rect x="91" y="194" width="18" height="22" rx="2.5" fill="#ffffff" stroke="#cfd5df" />
          <rect x="94" y="198" width="12" height="3" rx="1" fill="#6b46c1" opacity="0.8" />
        </g>
      )}
    </g>
  );
}

function Hands({ look, memo }: { look: Look; memo: boolean }) {
  const skin = look.skin;
  if (memo)
    return (
      <g className="memo">
        <g transform="rotate(-7 58 206)">
          <rect x="30" y="192" width="58" height="34" rx="3" fill="#ffffff" stroke="#d7dbe3" />
          <path d="M36 201 H80 M36 208 H76 M36 215 H70" stroke="#c9ced8" strokeWidth="1.2" />
        </g>
        <g className="pen">
          <path d="M70 210 L86 186" stroke="#2b2f3a" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="70" cy="208" rx="8.5" ry="6.5" fill={skin} />
        </g>
      </g>
    );
  if (look.prop === 'laptop')
    return (
      <g>
        <path d="M112 176 L180 176 L184 220 L108 220 Z" fill="#c4c9d3" />
        <circle cx="146" cy="198" r="3.5" fill="#e6e9ef" />
      </g>
    );
  return null;
}
