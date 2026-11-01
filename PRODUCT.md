# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: experienced professionals (roughly 3–10 years) who are changing jobs and have an interview scheduled or expected at a specific company — often after being approached by a headhunter. They practice in the days before the interview, usually on a PC, alone, wanting to be grilled on their own resume claims rather than generic questions. Korean speakers first; some prepare English interviews for foreign companies.

## Product Purpose
모두의면접관 lets anyone run a realistic mock interview built from their own resume, portfolio, the job posting and the company name. A panel of 3D interviewers (configured by function, level, gender and personality, including a pressure interviewer) runs the interview in a real order — icebreaking, self-introduction, motivation, resume-verification questions, competency, company, situational, reverse questions, closing — reacts with facial expressions, scores answers, and ends with a final report including a hiring-tendency verdict. Success: the candidate walks into the real interview having already been asked the hard questions about their own claims.

## Positioning
Questions are grounded in the candidate's own documents: each resume-verification question cites the exact passage it came from ("근거 보기"), and the server drops questions whose cited evidence does not exist. Generic question banks and chat-style AI interviewers cannot truthfully claim this.

## Operating Context
- Inputs: resume, portfolio (PDF/DOCX/paste), job posting, company name, role, career years. Personal details are masked in the browser before sending; nothing is stored on the server.
- Interview language Korean or English; UI language toggle separate.
- Text answers by default; optional browser voice (TTS questions, STT answers).
- Scoring shown after each answer (practice) or only at the end (real).
- Report: grade, verdict (pass/hold/fail tendency), per-interviewer comments, rubric averages (structure, specifics, job fit, consistency, delivery), rewritten answers, next questions; Markdown/PDF export.

## Capabilities and Constraints
- Stack: Vite + React + TypeScript, three.js procedural avatars, Cloudflare Pages Functions + KV, OpenRouter free models with fallback; deployed at ai-mock-interview-4rq.pages.dev.
- Free daily quotas (global, per device, per IP) and Turnstile bot check.
- **Pricing: undecided — to be added later.** No payment, accounts or plans exist yet; do not show prices or a checkout.
- English product name: undecided (inferred working label: "Modu Interviewer").

## Brand Commitments
- Name: **모두의면접관** (chosen by the owner; trademark check pending by the owner).
- Interviewers and names are fictional; no real people.

## Evidence on Hand
- Real product UI (the interview room, score card, report) — can be shown as interface fragments.
- A fictional sample candidate (src/samples/sample.ts) for demos.
- None: customers, testimonials, reviews, press, logos, usage statistics, pass-rate claims. Do not fabricate any.

## Product Principles
1. Grounded, not generic: every hard question points back to the candidate's own words.
2. Real rehearsal: the order, the people and the pressure of an actual Korean career interview.
3. Honest feedback: scores and verdicts are reference, never a promise of a hiring outcome.
4. Private by default: mask before sending, store nothing.

## Accessibility & Inclusion
Keyboard operable, visible focus, reduced-motion support, 2D fallback when WebGL is unavailable; Korean and English UI.
