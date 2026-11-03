---
name: 모두의면접관
description: Lavender / purple product UI — white surfaces, one purple accent with a soft gradient, rounded cards with gentle depth, calm semi-realistic 2D interviewer illustrations.
colors:
  bg: "#ffffff"
  bg-soft: "#f8f6fe"
  surface-2: "#f4f2fa"
  surface-3: "#ebe7f6"
  line: "#e7e4f0"
  ink: "#1b1f2e"
  ink-2: "#5b6072"
  ink-3: "#8a8fa0"
  accent: "#6b46c1"
  accent-2: "#8461e0"
  accent-ink: "#5835ad"
  accent-soft: "#efe9fc"
  beige: "#f6f2ea"
  ok: "#1d8a5a"
  warn: "#b26a00"
  bad: "#d14343"
gradients:
  accent: "linear-gradient(135deg, #8461e0 0%, #6b46c1 100%)"
  privacy-band: "linear-gradient(135deg, #2a2160 0%, #4b2f9a 100%)"
typography:
  family: "Pretendard Variable, Pretendard, sans-serif (only face)"
  display: { size: "clamp(2.4rem, 4.6vw, 4.2rem)", weight: 800, lineHeight: 1.12 }
  h2: { size: "clamp(1.8rem, 3.2vw, 2.8rem)", weight: 800 }
  body: { size: "1.0625rem", weight: 400, lineHeight: 1.55 }
  label: { size: "0.875rem", weight: 700 }
rounded: { sm: "10px", control: "12px", card: "14px", panel: "20px", band: "28px", pill: "999px" }
shadows:
  sm: "0 1px 2px rgba(27,31,46,.06), 0 2px 8px rgba(27,31,46,.05)"
  md: "0 12px 32px rgba(76,48,160,.10), 0 2px 6px rgba(27,31,46,.05)"
  lg: "0 24px 60px rgba(76,48,160,.16), 0 4px 12px rgba(27,31,46,.06)"
---

# Design System: 모두의면접관

## Overview

A friendly, trustworthy AI interview product. White page, a lavender wash (soft radial glows on the landing, `bg-soft` panels), one purple accent used for primary actions, progress, score bars and highlights. Cards are white with a 1px `line` border, rounded 14–20px and lifted by soft purple-tinted shadows. The interview room shows three calm, semi-realistic 2D interviewers behind a desk.

## Rules

- **One accent.** Purple (`accent`, gradient for primary buttons, bars and the total score tile). Green/amber/red only for verdict and status (pass/hold/fail, ok/weak/missing).
- **One typeface.** Pretendard. Headings 800 with tight tracking; Korean uses `word-break: keep-all`.
- **Cards, not lines.** Group with white cards on `bg-soft`, or `surface-2` tiles inside a card. Lines only as 1px `line` borders and step connectors.
- **Depth is soft.** `shadow-sm` for resting cards, `shadow-md` for featured content, `shadow-lg` for floating mock windows and the support pop-up.
- **Honest UI.** Demo mode and rule-based scoring are always labelled; the support pop-up never blocks the interview (top of the room, auto-hides).

## Components

- **Buttons:** primary = accent gradient, white text, 12px radius, purple glow; secondary = white with lavender border, purple text; ghost = `surface-2`.
- **Pill badge:** `accent-soft` background, purple text, sparkle icon (landing hero).
- **Hero mock:** browser window (traffic-light dots, brand, progress dots, timer and status pills), illustrated panel with nameplates, a speaking caption card, and a floating evaluation card (total pill, five bars, overall opinion).
- **Feature strip:** one white card, three items with lavender icon tiles.
- **Rubric bars:** label · 10px track (`surface-3`) with gradient bar · `n/20`.
- **Steps:** numbered circles joined by 2px connectors; done = filled purple, current = purple ring with halo.
- **Verdict badge:** pill in ok/warn/bad soft colours.
- **Score card:** gradient grade tile, big score, bars, STAR status chips, coaching.
- **Report:** one white sheet card: meta tiles, bars, total (gradient tile) / grade / verdict, overall opinion tile, per-question steps with scores, interviewer comments with thumbnails.
- **Support (token cost):** inline note with a pink heart tile and two buttons: KakaoPay (yellow, `KAKAOPAY_URL`) and Fairy (secondary, `FAIRY_URL`); an unset link hides its button, and a dismissible corner pop-up shown once per place per session (landing after 12s, room after 3 answers at the top for 15s, report after 2.5s).

## Interviewers

Semi-realistic flat vector, adult proportions, calm expressions (`src/avatar/Interviewer.tsx`). Impression from rank (age band, formality) and role (outfit, lanyard, laptop). States: neutral, smile, serious, doubt, nod, memo. Motion: blink every 4–6s (two frames), 7° nod, 3-stage mouth every 0.2–0.4s while speaking, 1.5px breathing, pen movement while noting; all off under reduced motion. `?avatars` shows every state.

## Motion

One easing `cubic-bezier(0.16, 1, 0.3, 1)`. Section reveal 700ms rise, score bars grow in (900ms, 90ms stagger), pop-up slides in 360ms. Everything off under `prefers-reduced-motion: reduce`.

## Imagery

Landing shots are captures of the product's own UI in demo mode with the fictional sample candidate; provenance in `public/landing/*.json`.
