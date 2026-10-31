# Spike: Supertonic 3 in-browser TTS

**Question:** Can Supertonic 3 (Supertone, ONNX, OpenRAIL-M) replace OS voices as the default "listen to questions" voice?

**Why it is a spike:** the upstream repo was archived on 2026-09-09 (no fixes), the model download size and mobile speed are unknown, and the development session that built the app could not reach `huggingface.co` (network policy), so nothing has been measured yet. The app ships with `SUPERTONIC_ENABLED = false` (`src/voice/supertonic.ts`) and uses OS voices.

## Probe (throwaway, on a real PC + a mid-range Android phone)
1. Open the official browser example (onnxruntime-web, WebGPU → WASM fallback) from `github.com/supertone-inc/supertonic`.
2. Record: total model bytes downloaded (first load), time to first audio, real-time factor (synthesis time ÷ audio duration) for a 120-char Korean sentence and a 25-word English sentence, on WebGPU and WASM.
3. Listen: Korean interview question (`그 수치는 어떻게 측정하셨나요?`) and English (`Could you walk us through your contribution?`) with one male and one female preset. Rate naturalness 1–5 vs. the OS voice.
4. Check the OpenRAIL-M use restrictions against `public/terms.html`.

## Pass criteria
- Download ≤ 150 MB (cached after first load), RTF ≤ 0.5 on PC (WebGPU) and ≤ 1.0 on the phone (WASM).
- Naturalness ≥ 4/5 for Korean and English, clearly better than OS voices.
- At least one usable male and one female preset per language.

## If it passes
Implement `loadSupertonic()` (lazy import of the runtime + model from the CDN, progress callback, Cache Storage), flip `SUPERTONIC_ENABLED`, add the model CDN to the CSP `connect-src` in `public/_headers`, and keep the RTF > 1 auto-fallback to OS voices.

## If it fails
Keep OS voices; re-evaluate Cloudflare Workers AI MeloTTS (≈18.6 neurons/audio-minute, ~500 free minutes/day, one Korean speaker).
