import type { Lang } from '../../shared/schema';

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export type Stt = { supported: boolean; start(onText: (full: string, final: boolean) => void, onError?: (e: string) => void): void; stop(): void };

export function createStt(lang: Lang): Stt {
  const Ctor = (globalThis as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition
    ?? (globalThis as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;
  if (!Ctor) return { supported: false, start() {}, stop() {} };
  let rec: Rec | null = null;
  let active = false;
  let committed = '';
  return {
    supported: true,
    start(onText, onError) {
      active = true;
      committed = '';
      const boot = () => {
        rec = new Ctor();
        rec.lang = lang === 'ko' ? 'ko-KR' : 'en-US';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) committed += (committed ? ' ' : '') + r[0].transcript.trim();
            else interim += r[0].transcript;
          }
          onText((committed + (interim ? ' ' + interim : '')).trim(), !interim);
        };
        rec.onerror = (e) => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            active = false;
            onError?.(e.error);
          }
        };
        // Chrome stops after silence; keep listening until the user stops.
        rec.onend = () => active && boot();
        rec.start();
      };
      boot();
    },
    stop() {
      active = false;
      rec?.stop();
    },
  };
}
