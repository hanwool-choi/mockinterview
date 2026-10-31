import type { Gender, InterviewerConfig, Lang } from '../../shared/schema';

export type VoiceProfile = { lang: Lang; gender: Gender; rate: number; pitch: number };
export interface TtsEngine {
  name: string;
  speak(text: string, v: VoiceProfile): Promise<void>;
  cancel(): void;
}

const FEMALE = /female|여성|sunhi|yuna|jimin|seoyeon|heami|sora|samantha|zira|aria|jenny|karen|victoria|susan|moira|tessa|fiona|serena/i;
const MALE = /(^|[^e])male|남성|injoon|hyunsu|bongjin|gookmin|daniel|david|guy|alex|fred|tom|ryan|arthur|oliver/i;
const NATURAL = /natural|online|neural|premium|enhanced/i;

export function pickOsVoice(voices: SpeechSynthesisVoice[], lang: Lang, gender: Gender): SpeechSynthesisVoice | null {
  const mine = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
  if (!mine.length) return null;
  const score = (v: SpeechSynthesisVoice) => {
    let s = NATURAL.test(v.name) ? 2 : 0;
    const f = FEMALE.test(v.name);
    const m = !f && MALE.test(v.name);
    if (gender === 'female' && f) s += 4;
    if (gender === 'male' && m) s += 4;
    if (gender !== 'none' && ((gender === 'female' && m) || (gender === 'male' && f))) s -= 4;
    return s;
  };
  return mine.map((v, i) => ({ v, s: score(v) - i * 0.001 })).sort((a, b) => b.s - a.s)[0].v;
}

export function voiceProfileFor(cfg: InterviewerConfig, lang: Lang): VoiceProfile {
  const p = cfg.personality === 'pressure' ? { rate: 1.1, pitch: 0.9 } : cfg.personality === 'warm' ? { rate: 0.95, pitch: 1.05 } : { rate: 1, pitch: 1 };
  return { lang, gender: cfg.gender, ...p };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function silentEngine(): TtsEngine {
  let cancelled = false;
  return {
    name: 'silent',
    async speak(text) {
      cancelled = false;
      const ms = Math.min(6000, Math.max(300, text.length * 45));
      for (let t = 0; t < ms && !cancelled; t += 100) await sleep(100);
    },
    cancel() {
      cancelled = true;
    },
  };
}

function osEngine(synth: SpeechSynthesis): TtsEngine {
  let voices = synth.getVoices();
  synth.addEventListener?.('voiceschanged', () => (voices = synth.getVoices()));
  return {
    name: 'os',
    speak(text, v) {
      return new Promise<void>((resolve) => {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voice = pickOsVoice(voices, v.lang, v.gender);
        if (voice) u.voice = voice;
        u.lang = v.lang === 'ko' ? 'ko-KR' : 'en-US';
        u.rate = v.rate;
        u.pitch = v.pitch;
        const done = () => resolve();
        u.onend = done;
        u.onerror = done;
        // Safety: some browsers never fire onend.
        setTimeout(done, Math.min(30000, 2000 + text.length * 120));
        synth.speak(u);
      });
    },
    cancel() {
      synth.cancel();
    },
  };
}

export function createTts(opts: { prefer: 'supertonic' | 'os' }): TtsEngine {
  void opts.prefer; // Supertonic is swapped in by the caller after loadSupertonic() resolves.
  const synth = typeof globalThis !== 'undefined' ? (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis : undefined;
  return synth ? osEngine(synth) : silentEngine();
}
