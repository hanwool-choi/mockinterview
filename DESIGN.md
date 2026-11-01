---
name: 모두의면접관
description: The interview evaluation sheet - a printed form in navy-black ink on white, marked by one red pen; handwritten scores, circled five-point cells and a verdict stamp.
colors:
  ground: "#ffffff"
  ground-2: "#f3f4f6"
  ground-3: "#e2e5ea"
  ink: "#141a26"
  ink-2: "#4a5263"
  ink-hover: "#2a3346"
  rule: "#141a26"
  rule-2: "#c3c9d2"
  pen: "#d93025"
  pen-deep: "#b3261e"
  pen-pale: "#fdeceb"
  mark: "#fff1a8"
  warn: "#8a5a00"
typography:
  display:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "clamp(2.5rem, 4.8vw, 4.4rem)"
    fontWeight: 800
    lineHeight: 1.08
  headline:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "clamp(1.9rem, 3.4vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.12
  body:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.3
  hand:
    fontFamily: "Nanum Pen Script, cursive"
    fontSize: "1.5rem-4.6rem"
    fontWeight: 400
    lineHeight: 1
rounded:
  control: "6px"
  field: "4px"
  sheet: "0"
spacing:
  margin: "clamp(20px, 3.4vw, 48px)"
  section: "clamp(96px, 13vw, 184px)"
  frame: "1224px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.control}"
    padding: "0.7em 1.3em"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-ghost:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  sheet:
    backgroundColor: "{colors.ground}"
    border: "2px {colors.rule} outer, 1px {colors.rule-2} inner"
    rounded: "{rounded.sheet}"
  pen-mark:
    stroke: "{colors.pen}"
    textColor: "{colors.pen-deep}"
---

# Design System: 모두의면접관

## Overview

The product is named after the person holding the pen, so the interface is that person's paper: the **면접 평가표**, the evaluation sheet that lies in front of every interviewer. Printed parts (labels, rules, headings, buttons) are navy-black form ink on white. Everything the evaluator does to the sheet is red pen: a ring around one of five scale cells, a handwritten number, a tick, a cross, a stamped verdict, a signature.

One sheet runs through the whole service. The landing shows a sample candidate's filled sheet as the first thing you see; the interview room header is the sheet's question strip, each box filled as the interview goes (grade in practice, a tick in real mode); every score card carries the five-point grid; the report *is* the completed sheet, rings, total, grade, stamp, opinion and signatures, followed by the detail.

Density is calm and PC first. Depth never comes from shadows or gradients. Lines exist because forms have lines; nothing else gets a rule.

### Named rules
- **Print and pen.** Ink is for what the form printed; red is only for what the evaluator wrote. Do not use red for buttons, headings or decoration.
- **Two faces.** Pretendard for print, Nanum Pen Script only for evaluator marks (scores, grades, opinions, signatures). Never set a heading or a sentence of product copy in the hand.
- **Rules belong to forms.** 2px ink for a form's outer edge and section breaks, 1px rule-2 inside. Non-form content (FAQ, features, panels) separates by space and tone.

## Colors

- **Form Ink** `#141a26`: text, form outer rules, primary buttons. Hover `#2a3346`.
- **Secondary Ink** `#4a5263`: field labels, captions, scale names.
- **Inner Rule** `#c3c9d2`: cell borders inside a form.
- **Red Pen** `#d93025`: graphic marks only (rings, ticks, crosses, stamp, focus-adjacent cues, current-question cell).
- **Red Pen Text** `#b3261e`: handwritten numbers and red text (6.2:1 on white). Pale `#fdeceb` for a selected row.
- **Highlighter** `#fff1a8`: the quoted resume line inside its source passage; demo/notice banners.
- **Grounds** `#ffffff`, `#f3f4f6` (label cells, field fills, panels), `#e2e5ea`.

## Typography

Pretendard Variable for everything printed: 800 tight for headings (`letter-spacing -0.025em`, display -0.045em), 700 for labels, 400 for reading; Korean uses `word-break: keep-all`. The hero h1 keeps its authored line break (`white-space: pre-line`). Smallest readable size is 13px (`0.8125rem`).

Nanum Pen Script (OFL, self-hosted via @fontsource, Korean + Latin subsets) for marks: rubric points 2rem, totals 3.6-4.6rem, opinions 1.5rem, signatures 1.6-2rem. A "/20" or "/100" beside a handwritten number is printed (Pretendard), a sibling element, not part of the hand.

## Layout

Frame 1224px inside a fluid margin. Landing: hero two columns (copy left, sample sheet right, max 560px); then the question sheet (numbered rows table left, selected question with interviewer, intent, follow-up and highlighted source passage right); panel (room video), modes, report, an ink band for privacy with pen-ticked boxes, FAQ, close. Report: one 960px column, the sheet first. Breakpoints 1100 / 860 / 767px; under 767px the sheet's header fields stack, scale names hide (numbers stay), the room strip spans the width.

## Components

- **Sheet** (`.sheet`, `SheetFields`): title row, label/value field grid, then sections divided by 2px ink.
- **RubricGrid**: criterion, five scale columns (매우 미흡 … 매우 우수), points. A filled row gets a `PenRing` around the cell `ceil(points/4)` and a handwritten point value. Compact variant in the score card.
- **Stamp**: double-bordered red rounded rectangle at -7deg with the verdict label.
- **SheetProgress**: numbered boxes (0 = opening), done boxes show the grade/score in hand or a `PenCheck`, current box outlined in red with a red number cell.
- **STAR line**: four checkbox cells; ok = pen tick, weak = hand triangle, missing = pen cross with the part name in red.
- **Buttons**: 6px radius, primary ink fill, ghost grey fill. Fields: 2px border, 4px radius, ink border on focus.

## Motion

One easing, `cubic-bezier(0.16, 1, 0.3, 1)`. On a sheet the pen writes: rings draw (stroke-dashoffset, 520ms, 260ms stagger by row), numbers fade in after their ring, totals/opinion/signatures at 1.7s, the stamp presses last (2.05s, scale 1.35→1). Score-card rings draw with a 90ms stagger. Section reveal 700ms rise. Everything is off under `prefers-reduced-motion: reduce`.

## Imagery

Landing shots are captures of the product's own UI (demo mode, fictional sample candidate) with provenance sidecars (`public/landing/*.json`). The room loop is the real 3D stage.
