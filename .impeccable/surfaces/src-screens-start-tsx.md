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

THESIS: The interview is a single subway line with twelve stations, from icebreaking to closing; a follow-up question is a transfer. The page refuses the category default of headline + product screenshot + three feature cards.

OWN-WORLD: Seoul metro signage. White ground, near-black ink, one committed line colour (Line 2 green) running as a thick track; stations are white dots with ink rings; transfers are larger ringed dots. Pretendard set heavy for station names, small English station names under them. Round station dots and fully round buttons; no shadows at rest, no gradients, no cards-as-structure.

STORY: The visitor sees their own interview as a route, taps a station to read a real question drawn from a sample resume with its source passage, understands the panel and the report, and starts.

FIRST VIEWPORT: Left two-thirds: h1 "내 이력서로 묻는 면접관들" at display size, one sentence under it, primary round button "내 면접 시작하기". Full-width green line across the lower half with 12 stations; the selected station opens a question board under it (question, interviewer, source passage).

FORM: Subway line map, grounded candidate 3 of 7. seed:3a0c0af4cc843d01

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
