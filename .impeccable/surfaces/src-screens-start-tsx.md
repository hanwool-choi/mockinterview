---
version: 1
slug: "src-screens-start-tsx"
primary_target: "src/screens/Start.tsx"
related_targets: ["src/screens/Room.tsx","src/screens/Report.tsx"]
---

# Surface: landing + app shell (모두의면접관)

Scope: landing (Persuade) at `/` start screen; app screens (Operate) prepare, panel, room, report inherit the same world.
Audience: experienced job changers (3–10y) with a real interview coming. Action: start a mock interview with their own resume. Proof: the real product (question grounded in a resume passage, the 3D panel, the report); no customers, stats or prices exist. Pricing undecided: no pricing section.

## Direction contract

THESIS: The interviewer's evaluation sheet, handed to the candidate before the interview. Every answer fills a row; the report is the finished sheet with the verdict stamped. The page refuses the category default of headline + product screenshot + three feature cards.

OWN-WORLD: A printed Korean 면접 평가표. White paper, navy-black form ink, 2px outer rules and 1px inner cell rules, grey label cells. One red pen for every evaluator mark: rings around a five-point cell, handwritten numbers (Nanum Pen Script), ticks, crosses, a rotated verdict stamp, signatures. Pretendard for print. No shadows, no gradients, no cream paper, no serif.

STORY: The visitor sees the sheet they will be scored on (a fictional sample, rings drawing in, stamp pressing last), opens a question row to see it built from a resume line, sees the panel and the modes, sees the finished sheet as the report, and starts.

FIRST VIEWPORT: Left: h1 "면접관의 평가표, / 면접 전에 먼저 채워보세요", one paragraph, ink button "내 면접 시작하기". Right: the sample evaluation sheet (지원자란, five rubric rows with rings and points, 총점, 판정 stamp, 종합 의견 in hand, three interviewer signatures).

FORM: Interview evaluation sheet, pick candidate 2 of the reroll list. seed:3a0c0af4cc843d01

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, DESIGN.md, and every shipping raster carrying its provenance
