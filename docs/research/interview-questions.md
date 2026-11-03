# How real interviewers ask: references for question generation

What the turn engine (`functions/_lib/prompts.ts` CRAFT rules, `src/engine/templates.ts`, `functions/_lib/question.ts`) is built to imitate, and how it is measured.

## What the sources agree on

1. **Questions start from the resume or portfolio, and they say which part.** Experienced-hire interviews in Korea are usually run by future teammates and built on the candidate's resume and portfolio ("보통 이력서와 포폴 기반으로 개인 경험을 설명하게") [1]. A good resume question names the project or company first, then asks about it. Throwing a figure without its context ("35% 개선에서 기여한 부분은?") makes the candidate guess what is meant.
2. **The core probe is the candidate's own part.** Interviewers isolate "I" from "we": when a candidate says the team did it, the follow-up asks what they personally did [3][4]. Korean reviews describe the same: your role in the experience, and how you handled disagreement while collaborating [2].
3. **Follow-ups pick up the candidate's own words and ask one thing.** Typical probes: what did you do then, what happened next, what was the result, walk me through your decision [3][5]. Each probe asks one thing; bundling several ("어떤 상황이었는지, 그리고 다른 대안은 없었는지, 있었다면 왜…") makes answers vague.
4. **Probe what the answer left open**: own role, reasoning behind a decision, how the result was measured, obstacles and alternatives, lessons. Metrics claims get "how did you measure that" [3]; technical choices get "why this option" [6].
5. **STAR as the frame**: situation, task, action, result. Follow-ups fill whichever part is weak [5][7].

## Rules in the product

| Rule | Where |
|---|---|
| Resume questions name where the claim comes from: "오늘장보기에 계실 때 "…"이라고 적어 주셨는데요." / "포트폴리오의 '…' 프로젝트에서" | `claimAnchor`, `koLead` in `src/engine/templates.ts` |
| Quote the whole result line, cut at a word boundary, drop "결과:" labels and trailing asides; correct particle (이라고/라고) | `tidyClaim`, `quoteKo` |
| Skills lists and section headers are never "achievements"; questions are spread over different claims | `notClaim`, `claimCandidates` |
| Model-written questions: context first, link to the last answer or signal the switch, one ask, ≤110 chars, no invented facts, probe what is most open | `CRAFT` in `functions/_lib/prompts.ts` |
| Server rejects a question that cites a figure absent from the documents/answers, or cites one without what it was about | `groundedQuestion` in `functions/_lib/question.ts` |
| Server keeps the planned question when the rewrite repeats the follow-up, wanders off the planned topic, or runs long | `usableNext` in `functions/api/score.ts` |

Bad and good:

- ✗ "35% 개선에서 기여한 부분은 무엇인가요?" (what improved, where?)
- ✗ "방금 61%에서 72%로 올렸다고 하셨는데…" (61% of what?)
- ✓ "오늘장보기에서 결제 단계를 줄여 이탈률을 32%에서 21%로 낮추셨다고 했는데, 그중 본인이 직접 결정한 건 무엇이었나요?"
- ✓ "팀이 같이 만든 결과라고 하셨는데, 본인이 직접 맡은 역할은 무엇이었나요?"

## Measurement

`scripts/bench/question-bench.ts` runs a scripted interview (strong, "we"-centred, vague and off-topic answers) through the score prompt and checks what the candidate would see.

Production model (gemini-2.5-flash-lite), same script, 2026-11-03:

| | before | after |
|---|---|---|
| No bare or invented figure | 100% | 100% |
| One ask per question | 88% | 100% |
| Average length (chars) | 91 | 69 |
| Resume questions naming company/project | 0 of 3 | 3 of 3 |
| Skills line asked as an achievement | yes ("SQL, GA4…의 성과가 본인 덕분…") | no |
| Next question drifting into a second follow-up | seen in earlier runs | caught, draft used |

Limits: one script, one model, small sample; the checks are heuristics (shared word pieces), so they can miss a vague question that happens to share words, or reject an unusual but fine one (then the planned question is used, never nothing).

## Sources

1. 요즘IT (wishket), 경력직 면접 방식과 준비: https://yozm.wishket.com/magazine/detail/2476
2. 캐치, 지원자 면접 후기 댓글(역할, 의견 충돌 대처): https://www.catch.co.kr/NCS/RecruitInfoDetails/552201
3. Monster Hiring, Behavioral interviewing tips (probe for metrics and detail): https://hiring.monster.com/resources/recruiting-strategies/interviewing-candidates/behavioral-interviewing-tips
4. Grove VC, interview questions playbook (candidate's actual role): https://www.grovevc.com/playbooks/people-first-playbook/interview-questions/
5. CMU Career, behavioral interview guide (STAR, probes): https://www.cmu.edu/career/faculty-and-staff/documents-for-career-champions/behavioral-interview-guide.pdf
6. 인프런 Q&A, 기술 선택 꼬리질문 예: https://www.inflearn.com/community/questions/1730722/강의내용-질문있습니다
7. Metaview, STAR method interview questions: https://www.metaview.ai/resources/interview-questions/star-method-interview-questions
8. 하이잡, 경력직 면접 질문 정리: https://www.haijob.co.kr/blog/interview-questions-for-experienced-workers-top-10-best-answer-example-summary

Company-specific review boards (잡플래닛, 블라인드) need a login and were not quoted.
