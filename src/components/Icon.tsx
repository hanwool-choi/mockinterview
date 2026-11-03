type Name = 'chevron' | 'arrowLeft' | 'arrowRight' | 'mic' | 'stop' | 'pause' | 'play' | 'shuffle' | 'star' | 'download' | 'print' | 'volume' | 'doc' | 'chat' | 'chart' | 'sparkle' | 'clock' | 'check' | 'x' | 'wave' | 'shield' | 'users' | 'heart';

const PATHS: Record<Name, string> = {
  chevron: 'M9 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  stop: 'M7 7h10v10H7z',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 5l12 7-12 7z',
  shuffle: 'M4 7h3c4 0 6 10 10 10h3M4 17h3c1.6 0 2.8-1.6 3.9-3.5M14 10.5C15 8.6 16.2 7 17.5 7H20M17 4l3 3-3 3M17 14l3 3-3 3',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  print: 'M7 9V4h10v5M7 17H5v-6h14v6h-2M8 14h8v6H8z',
  volume: 'M5 10v4h3l4 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 12h6M10 16h6',
  chat: 'M4 5h16v11H9l-5 4zM9 10h.01M12 10h.01M15 10h.01',
  chart: 'M5 20V12M12 20V5M19 20v-9M3 20h18',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  wave: 'M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4',
  shield: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15c2 .6 3.2 2.3 3.5 5',
};

/** One stroke family (2px, round caps) for every icon in the product. */
export function Icon({ name, size = 18, filled = false }: { name: Name; size?: number; filled?: boolean }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}
