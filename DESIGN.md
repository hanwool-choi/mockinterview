---
name: 모두의면접관
description: A Seoul-metro line map for a mock interview - white ground, near-black ink, one green track, round stations and fully round buttons.
colors:
  ground: "#ffffff"
  ground-2: "#f2f3f0"
  ground-3: "#e6e8e3"
  ink: "#141414"
  ink-2: "#4b4f4a"
  line: "#00a84d"
  line-deep: "#007a39"
  line-deep-hover: "#006f33"
  line-pale: "#dff3e7"
  line-pale-hover: "#cdebd9"
  mark: "#fff1a8"
  warn: "#9a5b00"
  bad: "#c62828"
  stage-backdrop: "#e9eef3"
typography:
  display:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Noto Sans KR, sans-serif"
    fontSize: "clamp(2.6rem, 5.2vw, 4.75rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "clamp(1.9rem, 3.6vw, 3.2rem)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  round: "999px"
  panel: "14px"
  field: "10px"
  focus: "6px"
spacing:
  margin: "clamp(20px, 3.4vw, 48px)"
  section: "clamp(96px, 14vw, 200px)"
  frame: "1224px"
  hero-gap: "3.5rem"
  stack: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.line-deep}"
    textColor: "{colors.ground}"
    rounded: "{rounded.round}"
    padding: "0.7em 1.3em"
  button-primary-hover:
    backgroundColor: "{colors.line-deep-hover}"
  button-primary-big:
    backgroundColor: "{colors.line-deep}"
    textColor: "{colors.ground}"
    rounded: "{rounded.round}"
    padding: "0.95em 1.6em"
  button-ghost:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.round}"
    padding: "0.6em 1.1em"
  button-ghost-hover:
    backgroundColor: "{colors.ground-3}"
  chip:
    backgroundColor: "{colors.line-pale}"
    textColor: "{colors.line-deep}"
    rounded: "{rounded.round}"
    padding: "0.5em 1em"
  field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0.65em 0.8em"
  panel:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  panel-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.panel}"
---

# Design System: 모두의면접관

## Overview

**Creative North Star: "The Line Map"**

The mock interview is drawn as one Seoul-metro line: twelve stations from icebreaking to closing, a follow-up question being a transfer. The interface is signage, not software chrome. A white ground, near-black ink and a single committed line colour (Line 2 green) carry everything; the green track is the only large coloured gesture, and it runs through the page as a spine, across the landing as a route, and along the top of the interview room as a progress line.

Density is calm and PC first. Type is heavy and tight for station names and headings, plain for reading. Surfaces are flat tonal steps of grey-green; depth never comes from shadows or gradients. Round shapes (station dots, fully round buttons) are the only decorative geometry, and they come from the line map itself.

The build matches the direction contract's OWN-WORLD. One extension the contract did not name: a full-bleed `line-deep` green band (the privacy section) with a white track and white-ringed stations, the line map inverted.

**Key Characteristics:**
- One ground, one ink, one line colour; green appears as track, primary fill and small text only.
- Station language: white dot, 4px ink ring; transfer = larger ring with a second outer ring.
- Fully round buttons, flat, no shadow at rest or on hover.
- Tonal panels (ground-2, ground-3, ink) instead of cards with elevation; no gradients anywhere.
- Authored SVG icons, 2px round stroke.
- Real product captures and a recorded 3D-room loop as the only imagery.

## Colors

A near-monochrome ground and ink pair, one metro green split into a graphic value and a text-safe value, and a highlighter yellow reserved for evidence.

### Primary
- **Line 2 Green** (#00a84d): the track, and nothing that needs to be read. 3.1:1 on white, so graphics only (track, selection pulse, link underline, text selection background).
- **Line 2 Deep Green** (#007a39): primary button fill, text accents (station name when selected, labels, "ok" states, focus ring), the inverted privacy band. 5.5:1 on white, 4.9:1 on ground-2. Hover darkens to #006f33.
- **Line Pale** (#dff3e7): chip fill (hover #cdebd9) with Deep Green text.

### Neutral
- **Platform White** (#ffffff): page ground, field fill, dot interior, score-card surface.
- **Concourse Grey** (#f2f3f0): first panel step: boards, FAQ rows, mode tiles, ghost buttons, screenshot frames.
- **Tile Grey** (#e6e8e3): second step: hover of ground-2 surfaces, field border, disabled fill, answer box, scrollbar thumb.
- **Signage Ink** (#141414): body and headings, station rings, selected-station fill, selected mode tile.
- **Secondary Ink** (#4b4f4a): captions, English station names, muted text.
- **Stage Backdrop** (#e9eef3): the cool backdrop behind the 3D room and the hero video frame; it belongs to the captured imagery, not to UI.

### Signal
- **Highlighter** (#fff1a8): the source-passage mark, the demo note and notices; marks "this is the evidence" or "this is a sample".
- **Amber** (#9a5b00): warnings and grade C. **Red** (#c62828): errors, danger ghost, grade D.

### Named Rules
**The Graphic-vs-Text Green Rule.** #00a84d is never used for text or for a fill carrying text. Anything read uses Deep Green (#007a39) or ink.
**The One Line Rule.** There is one line colour. Do not add a second line colour, and do not tint panels with it beyond Line Pale chips.
**The Highlighter Rule.** Yellow marks evidence and sample/notice status only; never decoration.

## Typography

**Display / Body / Label Font:** Pretendard Variable (self-hosted via the `pretendard` npm package, imported in `src/main.tsx`), falling back to Pretendard, system sans, Apple SD Gothic Neo, Noto Sans KR.

**Character:** one family, heavy (800) and tightly tracked for station names and headings, regular for reading. Korean text uses `word-break: keep-all`, `text-wrap: balance` on headings and `pretty` on paragraphs.

### Hierarchy
- **Display** (800, clamp(2.6rem, 5.2vw, 4.75rem), 1.04, -0.045em): landing h1 only, max 10.5em wide.
- **Headline** (800, clamp(1.9rem, 3.6vw, 3.2rem), 1.12): landing section h2.
- **Title** (800, 1.3rem; section h3 up to 1.75rem; board question 1.75rem / 1.38): station boards, mode headings.
- **Body** (400, 1.0625rem, 1.55): default; landing lead and feature copy 1.3125rem / 1.6-1.65; reading blocks capped near 62-65ch.
- **Label** (700, 0.875rem): `.label`, `.muted` captions, small buttons; station English names 0.875rem at 500 in Secondary Ink; compact station names 0.72rem.
- **Score numerals** use 900 weight and tabular figures.

### Named Rules
**The Heavy Name Rule.** Station names and headings are 800 weight; do not use light weights for emphasis.
**The No Kicker Rule.** No small uppercase or tracked-out label above a heading. The small English station name sits under a station, as signage does, and is not a kicker.

## Layout

PC first. Page frame is 1224px (`--frame`) inside a fluid margin `clamp(20px, 3.4vw, 48px)`; header and footer align to the same frame via `--frame-pad`. The landing hero is two columns (1.05fr / 1fr, 3.5rem gap) with copy left and the recorded room loop right; the 12-station route spans the full width beneath, opening a board (question, interviewer, source passage) under the selected station. Sections are separated by `--gap-section` (96-200px), not by rules or card borders.

**The page spine.** Down the landing the line continues as a vertical spine: left padding 84px, a 12px green track and a 30px white dot with 5px ink ring at each feature heading, and a 44px terminus (8px ring, outer green ring) at the close. Under 860px the spine narrows (40px padding, 8px track, 22px dots, 32px terminus).

**Responsive.** Breakpoints: 1100px (English station names hide, room body narrows to a 340px side column, board becomes one column), 860px (all landing grids go single column, top links hide, hero order is copy, route, media; the route turns vertical: stations stack in a column with the green track running down the left, name and English name inline), 767px (room stage becomes a stacked 36vh block). Mobile is supported, not the design target.

**Motion.** One easing, `cubic-bezier(0.16, 1, 0.3, 1)` (`--ease-out`). State changes 160-220ms; section reveal 700ms rise of 24px; board entry 420ms; selected-station pulse 1.8s. All transitions and animations are disabled under `prefers-reduced-motion: reduce`; reveal and pulse only exist under `no-preference`.

## Elevation & Depth

Flat. There is no `box-shadow` and no gradient anywhere in the stylesheet. Depth is tonal: White, Concourse Grey, Tile Grey, Ink are the steps. A panel sits one step off its container; selection inverts to ink with white text. Interaction feedback is a colour step, a dot scale (hover 1.15, selected 1.25) or a 1px press, never a lift. Focus is a 3px Deep Green outline with 3px offset.

### Named Rules
**The Tonal Step Rule.** To raise a surface, change its tone one step. Never add a shadow, blur or border glow.

## Shapes

Two families only: circles and soft rectangles. Buttons, chips, pills, count pickers, grade badges, avatars and station dots are fully round (999px / 50%). Panels, boards, FAQ rows and screenshot frames use 14px; fields 10px; phone capture 22px. The track itself is a capsule (radius equals its thickness). Rings are thick and ink: 4px on hero dots, 5px on spine dots, 3px on compact dots and list ticks.

## Components

### The Line Map (signature)
`LineMap` renders `<nav><ol>` of stations over an absolutely positioned track. Hero size: 26px dots, 12px green track inset half a column from each end, station name 800 at 1.0625rem with the English name beneath; stations are buttons (`aria-pressed`) on the landing. Compact size (used in the interview room header): 16px dots, 6px track, 0.72rem names, no English name, no marks. Station states: default white dot with ink ring; selected = ink-filled dot at scale 1.25 with name in Deep Green and a pulse; compact done = Deep Green filled, now = ink filled at 1.35 with 800 name. Transfer station (a follow-up branch point): 5px ring plus an outer 3px ink ring at 3px offset (compact 2px/2px); may carry a short mark inside (hero only). Terminus: the largest dot, double ring in green, ends the spine and carries no downward track.

### Buttons
- **Shape:** fully round (999px), flat, 700 weight, no border, no shadow.
- **Primary:** Deep Green fill, white text, padding 0.7em 1.3em; `big` 1.08rem / 0.95em 1.6em for the hero action; disabled becomes Tile Grey fill with Secondary Ink text.
- **Ghost / Quiet:** Concourse Grey fill, ink text; hover Tile Grey; `danger` turns text red; `small` 0.875rem.
- **Chip:** Line Pale fill, Deep Green text.
- **Link:** ink, 700, underlined with a 2px Line 2 Green underline; hover text Deep Green.
- **States:** 160ms ease-out on background and colour; active presses by 1px and scale 0.98.

### Fields
Real fields keep a line: 2px Tile Grey border, 10px radius, white fill; hover border #cfd3cc; focus border Deep Green with outline suppressed (border shift is the focus cue). Labels are 700 at 0.95rem above the field. Textareas have 1.6 line height and 120px minimum. Checkboxes are 22px with the project accent colour. The answer box is a Tile Grey tray whose textarea has a transparent border until focus.

### Panels
Boards, mode tiles, toggles, FAQ rows and screenshot frames: Concourse Grey, 14px radius, no border, no shadow, padding clamp(1.4rem, 3vw, 2.6rem) for boards. Selected tile inverts to ink with white text. The score card sits on white over the Tile Grey tray. No kickers or eyebrows above panel content; panels open with the content itself. The source passage sets the cited sentence in a Highlighter mark.

### Score and report
Grade badge is a round 56px (112px XL) ink disc, Deep Green for S/A, amber for C, red for D, with a text-only variant. Rubric bars are 10px capsules in Line 2 Green on a grey track, darkening to Deep Green on row hover. Verdict is a round pill.

### Icons
Authored inline SVG in one family: 24 viewBox, `stroke="currentColor"`, 2px stroke, round caps and joins, no fill (play/star may fill), default 18px, sized by the surrounding text. No icon fonts, no emoji, no glyph characters used as icons. Decorative dots (list ticks, FAQ markers) are CSS circles in the station-dot style.

### Imagery
Only two kinds: real product captures (room, score card, report, phone room: `public/landing/*.webp`) shown in Concourse Grey frames with 14px radius, and the recorded 3D-room loop (`room-loop.mp4`, poster `room-loop-poster.webp`) with a caption beneath. Interviewers and the sample candidate are fictional and labelled so (the board and demo note say sample / fictional). No stock photos, no illustrations of people, no fabricated logos, customers, statistics or prices.

## Do's and Don'ts

### Do:
- **Do** use #007a39 for any green text or green fill that carries text; #00a84d only for track and graphics.
- **Do** build new layouts from the line: a track, stations, a spine. Use transfer rings for branches and a double-ringed terminus for the end.
- **Do** keep every button fully round and flat; separate surfaces by one tonal step.
- **Do** draw icons as authored SVG with a 2px round stroke.
- **Do** label sample or fictional data where it appears.
- **Do** give the line vertical orientation under 860px and keep it as the page's structure.
- **Do** honour `prefers-reduced-motion`; use only `--ease-out`.

### Don't:
- **Don't** use `box-shadow`, `text-shadow`, glow or any gradient.
- **Don't** add kickers, eyebrows, section numbers or small uppercase labels above headings.
- **Don't** structure content as a row of three feature cards, or as bordered cards-as-structure; the headline-plus-screenshot-plus-three-cards layout is refused.
- **Don't** use emoji, icon fonts or glyph characters as icons.
- **Don't** introduce a second line colour, a dark theme, or green-tinted panel fills.
- **Don't** set text in #00a84d or light-weight display type.
- **Don't** show prices, testimonials, logos, user counts or pass-rate claims; none exist.
- **Don't** use generic stock imagery or invented 3D renders; show the real room.
