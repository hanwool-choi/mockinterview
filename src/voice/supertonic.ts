import type { TtsEngine } from './tts';

/**
 * Supertonic 3 (in-browser neural TTS) adapter — EXPERIMENTAL, disabled until the
 * verification spike (docs/spikes/supertonic-spike.md) passes:
 * model size, real-time factor on PC/mobile, and Korean/English listening quality.
 */
export const SUPERTONIC_ENABLED = false;
export const SUPERTONIC_MODEL_ID = 'Supertone/supertonic-3';

export async function loadSupertonic(onProgress?: (pct: number) => void): Promise<TtsEngine | null> {
  if (!SUPERTONIC_ENABLED) return null;
  void onProgress;
  return null;
}
