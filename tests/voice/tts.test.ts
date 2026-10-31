import { describe, it, expect } from 'vitest';
import { pickOsVoice, voiceProfileFor, createTts } from '../../src/voice/tts';

const V = (name: string, lang: string) => ({ name, lang, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

describe('pickOsVoice', () => {
  const voices = [V('Google 한국의', 'ko-KR'), V('Microsoft SunHi Online (Natural) - Korean', 'ko-KR'), V('Microsoft InJoon Online', 'ko-KR'), V('Samantha', 'en-US'), V('Daniel', 'en-GB')];
  it('prefers a gender-matching voice for the language', () => {
    expect(pickOsVoice(voices, 'ko', 'female')?.name).toContain('SunHi');
    expect(pickOsVoice(voices, 'ko', 'male')?.name).toContain('InJoon');
    expect(pickOsVoice(voices, 'en', 'female')?.name).toBe('Samantha');
    expect(pickOsVoice(voices, 'en', 'male')?.name).toBe('Daniel');
  });
  it('falls back to the first voice of the language, or null', () => {
    expect(pickOsVoice([V('Google 한국의', 'ko-KR')], 'ko', 'male')?.name).toBe('Google 한국의');
    expect(pickOsVoice([V('Samantha', 'en-US')], 'ko', 'female')).toBeNull();
  });
  it('prefers natural/online voices', () => {
    expect(pickOsVoice([V('Yuna', 'ko-KR'), V('Microsoft SunHi Online (Natural)', 'ko-KR')], 'ko', 'female')?.name).toContain('Natural');
  });
});

describe('voiceProfileFor', () => {
  it('pressure speaks faster and lower; warm slower and higher', () => {
    const base = { id: 'a', role: 'hr', rank: 'lead', gender: 'female', seed: 1 } as const;
    expect(voiceProfileFor({ ...base, personality: 'pressure' }, 'ko')).toMatchObject({ rate: 1.1, pitch: 0.9 });
    expect(voiceProfileFor({ ...base, personality: 'warm' }, 'ko')).toMatchObject({ rate: 0.95, pitch: 1.05 });
    expect(voiceProfileFor({ ...base, personality: 'strict' }, 'en')).toMatchObject({ rate: 1, pitch: 1, lang: 'en', gender: 'female' });
  });
});

describe('createTts', () => {
  it('returns a silent engine without speechSynthesis that waits proportionally', async () => {
    const tts = createTts({ prefer: 'os' });
    expect(tts.name).toBe('silent');
    const t0 = Date.now();
    await tts.speak('짧게', { lang: 'ko', gender: 'none', rate: 1, pitch: 1 });
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
