# AI 모의면접실

이력서·포트폴리오·채용공고·회사명을 넣으면, 그 내용을 근거로 질문하는 3D 면접관들과 실제 면접처럼 연습하고 종합 리포트를 받는 공개 웹서비스입니다.

- 설계: [`docs/specs/2026-10-31-mock-interview-service-design.md`](docs/specs/2026-10-31-mock-interview-service-design.md)
- 구현 계획: [`docs/plans/2026-10-31-mock-interview-service.md`](docs/plans/2026-10-31-mock-interview-service.md)

## 핵심 기능
- **이력서 검증형 질문**: 문서를 조각내 BM25로 색인하고, 질문마다 근거 조각 ID를 붙입니다(화면에서 "근거 보기"). 존재하지 않는 근거는 서버가 걸러냅니다.
- **실제 면접 흐름(11문항)**: 인사·아이스브레이킹 → 자기소개 → 지원동기/이직사유 → 경험 검증 3 → 직무역량 2 → 회사 이해 → 상황·인성 → 역질문 → 마무리. 꼬리질문은 기본 1회, 압박 면접관은 2회입니다.
- **3D 면접관**: three.js 코드로 생성합니다(외부 모델 파일 없음). 직무·직급·성별·성격에 따라 외형이 바뀌고, 미소·끄덕임·갸우뚱·찡그림 표정을 짓습니다. WebGL이 없으면 2D 초상화로 대체합니다.
- **채점**: 5개 항목(각 20점) 기준이고, 시점은 연습(답변마다 보기)과 실전(끝나고 한 번에) 중 고릅니다. AI가 실패하면 자체 채점으로 대체합니다.
- **리포트**: 판정(합격/보류/불합격 성향), 면접관별 총평, 항목 평균, 문항별 다시 쓴 답변을 담고 Markdown이나 PDF로 저장할 수 있습니다.
- **한국어/영어 면접**: 영어 면접에서는 '전달력' 항목을 영어 표현으로 평가합니다.
- **음성(선택)**: 질문 듣기는 브라우저 TTS, 말로 답하기는 브라우저 STT를 씁니다.

## 구조
```
src/            React 앱 (screens, components, engine=순수 TS 상태머신·채점, avatar=three.js, docs=추출·마스킹·BM25, voice)
functions/api/  Cloudflare Pages Functions: session · plan · score · report · config · event
functions/_lib/ OpenRouter 무료 모델 체인, JSON 복구, 사용량 제한, 보안, 프롬프트, 가짜(fake) LLM
shared/         앱과 함수가 함께 쓰는 zod 스키마·타입
tests/          Vitest 단위·통합 테스트
e2e/smoke.mjs   Playwright 스모크 (가짜 LLM 모드로 한국어 PC 연습 + 영어 모바일 실전 완주)
```

## 로컬 실행
```bash
npm install
npm test
```
가짜 LLM 모드로 앱과 API를 함께 실행합니다(키 불필요).
```bash
npm run build && npm run preview:full   # http://localhost:8788
```
실제 모델을 쓰려면 `.dev.vars.example`을 `.dev.vars`로 복사하고 키를 채운 뒤 다시 실행하세요. `.dev.vars`는 커밋하지 마세요.

## 배포 (Cloudflare Pages)
1. KV 이름공간을 만들고, 출력된 id를 `wrangler.toml`의 `IV_KV`에 넣습니다.
   ```bash
   npx wrangler kv namespace create IV_KV
   ```
2. Pages 프로젝트를 만듭니다.
   ```bash
   npx wrangler pages project create ai-mock-interview
   ```
3. 시크릿을 등록합니다(값은 프롬프트에 입력).
   ```bash
   npx wrangler pages secret put OPENROUTER_API_KEY --project-name ai-mock-interview
   ```
   ```bash
   npx wrangler pages secret put DEVICE_SECRET --project-name ai-mock-interview
   ```
   ```bash
   npx wrangler pages secret put TURNSTILE_SECRET --project-name ai-mock-interview
   ```
   - `OPENROUTER_API_KEY`가 있으면 `DEVICE_SECRET`과 `TURNSTILE_SECRET`도 반드시 있어야 합니다. 둘 중 하나라도 없으면 `/api/session`이 503을 반환합니다(공용 키 보호를 위해 일부러 막음). `DEVICE_SECRET`은 긴 무작위 값으로 설정하세요.
   - Turnstile 사이트 키는 `wrangler.toml`의 `TURNSTILE_SITEKEY`에 넣습니다.
4. 배포합니다.
   ```bash
   npm run build && npx wrangler pages deploy dist --project-name ai-mock-interview
   ```
   CI에서 자동 배포하려면 GitHub 시크릿 `CLOUDFLARE_API_TOKEN`과 `CLOUDFLARE_ACCOUNT_ID`를 등록하세요. `main`에 푸시하면 배포됩니다.
5. (선택) Workers Analytics Engine 데이터셋을 `EVENTS` 바인딩으로 연결하면 지표 이벤트가 쌓입니다.

## 운영 설정 (`wrangler.toml` vars)
| 변수 | 기본값 | 의미 |
|---|---|---|
| `DAILY_GLOBAL_INTERVIEWS` | 75 | 하루 전체 면접 수(KST 0시 초기화) |
| `DAILY_DEVICE_INTERVIEWS` | 3 | 기기당 하루 면접 수 |
| `DAILY_IP_INTERVIEWS` | 6 | IP당 하루 면접 수 (기기 토큰을 버리는 우회 차단) |
| `PREFERRED_MODELS` | deepseek,qwen,llama-3.3,gemma,mistral | 무료 모델 우선순위(부분 문자열) |
| `PAID_OVERFLOW` / `PAID_MODEL` | off / — | 무료 체인이 모두 실패하면 유료 모델을 1회 시도 |
| `ALLOWED_ORIGINS` | — | 같은 출처 외에 허용할 Origin(쉼표 구분) |

**OpenRouter 크레딧**: 크레딧이 0이면 무료 모델은 하루 약 50회만 호출할 수 있습니다(면접 약 4회). 10달러 이상 충전하면 하루 약 1,000회(면접 약 80회)로 늘어납니다. 런칭 전 충전을 권장하며, 한도는 OpenRouter 문서에서 다시 확인하세요.

## 개인정보·보안
- 서버는 문서와 답변을 저장하지 않습니다. KV에는 사용량 카운터, 세션 호출 수(6시간), 모델 목록만 둡니다.
- 문서는 브라우저에서 마스킹(이메일·전화·주소·주민번호·이름)한 뒤 전송합니다.
- 문서는 `<document>` 구분자 안의 데이터로만 프롬프트에 넣고, 문서 속 지시는 따르지 않게 합니다. 응답은 스키마로 검증합니다.
- 세션당 호출 상한은 plan 1, score 16, report 1이고, 요청 본문 크기(UTF-8 바이트 기준)와 Origin도 검사합니다. 실제 키를 쓸 때 Turnstile은 필수입니다.
- **알려진 한계**: KV는 원자적 증가를 지원하지 않습니다. 같은 세션이나 기기에서 동시에 요청을 몰아 보내면 상한을 조금 넘길 수 있습니다. 런칭 시 Cloudflare 대시보드의 Rate Limiting 규칙(`/api/*`, IP당 분당 30회 정도)을 함께 켜세요. `PAID_OVERFLOW`를 켜기 전에는 카운터를 Durable Object로 옮기는 작업을 권장합니다.
- `npm run scan`이 리포지토리와 빌드 결과에서 API 키 패턴을 찾습니다(CI에서 실행).

## 지표 (/api/event, 개인정보 없음)
`start`(면접 언어), `complete`(모드, 점수), `rating`(1~5), `fallback`(plan, score, report)

## 음성
- TTS는 OS 음성을 씁니다. Supertonic 3(브라우저 신경망 TTS)는 [검증 스파이크](docs/spikes/supertonic-spike.md)를 통과하면 켭니다(`src/voice/supertonic.ts`).
- STT는 브라우저 `SpeechRecognition`을 씁니다(Chrome·Edge·Safari).

## 2차 로드맵
공유 카드(OG 이미지, 공개 링크)를 가장 먼저 하고, 이어서 말버릇·말속도 분석, 내 기록·성장 그래프, 스캔 PDF OCR, 브라우저 Whisper를 진행합니다.
