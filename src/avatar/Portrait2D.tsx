import type { FaceState } from './expression';
import type { Look } from './look';

type Props = { look: Look; face: FaceState; speaking?: boolean; size?: number; title?: string };

/** 2D fallback & thumbnail: same look + same FaceState as the 3D rig. */
export function Portrait2D({ look, face, speaking, size = 120, title }: Props) {
  const curve = face.mouth.smile - face.mouth.pout;
  const mouthY = 74;
  const mouthD = `M44 ${mouthY} Q60 ${mouthY + curve * 12} 76 ${mouthY}`;
  const open = speaking ? 0.5 : face.mouth.open;
  const eyeRy = Math.max(0.6, 4.2 * face.eyeOpen);
  const browY = 44 - face.browY * 3;
  const roll = (face.headRoll * 180) / Math.PI;
  const hair = look.hair.color;
  const shirtFront = look.outfit.kind === 'suit' || look.outfit.kind === 'jacket' || look.outfit.kind === 'tie';
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={title} className="portrait2d">
      <rect width="120" height="120" rx="16" fill="#e9eef3" />
      <path d="M18 120 Q20 92 60 90 Q100 92 102 120 Z" fill={look.outfit.color} />
      {shirtFront && <path d="M52 91 L60 108 L68 91 Z" fill="#f4f6f8" />}
      {(look.outfit.kind === 'suit' || look.outfit.kind === 'tie') && <rect x="58" y="94" width="4" height="16" fill={look.outfit.accent} />}
      <g transform={`rotate(${roll} 60 58)`}>
        <rect x="54" y="78" width="12" height="12" fill={look.skin} />
        <ellipse cx="60" cy="56" rx="26" ry="28" fill={look.skin} />
        {look.hair.style !== 'bald' && <path d="M33 54 Q34 26 60 26 Q86 26 87 54 Q80 38 60 38 Q40 38 33 54 Z" fill={hair} />}
        {look.hair.style === 'bald' && <path d="M34 58 Q34 50 37 46 M86 58 Q86 50 83 46" stroke={hair} strokeWidth="5" fill="none" />}
        {look.hair.style === 'bob' && <path d="M33 54 Q31 72 38 80 L40 56 Z M87 54 Q89 72 82 80 L80 56 Z" fill={hair} />}
        {look.hair.style === 'long' && <path d="M33 52 Q28 84 36 98 L42 60 Z M87 52 Q92 84 84 98 L78 60 Z" fill={hair} />}
        {look.hair.style === 'bun' && <circle cx="60" cy="24" r="9" fill={hair} />}
        {look.hair.style === 'side' && <path d="M40 40 Q55 30 74 36 Q60 36 48 46 Z" fill={hair} />}
        <rect x="42" y={browY - 1.5 - face.browL * 2} width="12" height="3" rx="1.5" fill={look.ageGray ? '#8a8a8a' : hair} transform={`rotate(${-face.browL * 14} 48 ${browY})`} />
        <rect x="66" y={browY - 1.5 - face.browR * 2} width="12" height="3" rx="1.5" fill={look.ageGray ? '#8a8a8a' : hair} transform={`rotate(${face.browR * 14} 72 ${browY})`} />
        <ellipse cx="48" cy="56" rx="3.6" ry={eyeRy} fill="#1d1d1f" />
        <ellipse cx="72" cy="56" rx="3.6" ry={eyeRy} fill="#1d1d1f" />
        {look.glasses && (
          <g stroke="#222" strokeWidth="1.8" fill="none">
            <circle cx="48" cy="56" r="8" />
            <circle cx="72" cy="56" r="8" />
            <path d="M56 55 L64 55" />
          </g>
        )}
        <circle cx="40" cy="66" r="5" fill="#ff8a8a" opacity={face.blush * 0.5} />
        <circle cx="80" cy="66" r="5" fill="#ff8a8a" opacity={face.blush * 0.5} />
        <path d={mouthD} stroke="#7a3b3b" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        {open > 0.05 && <ellipse cx="60" cy={mouthY + 4} rx="6" ry={6 * open} fill="#5a2328" />}
      </g>
    </svg>
  );
}
