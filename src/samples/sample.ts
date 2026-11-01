import type { Docs } from '../state/setup';

/** Fictional sample candidate for "try with a sample" (no real person). */
export const SAMPLE: Record<'ko' | 'en', { company: string; role: string; years: number; docs: Docs }> = {
  ko: {
    company: '그린마켓',
    role: '서비스 기획자',
    years: 5,
    docs: {
      jd: `[그린마켓] 서비스 기획자 (경력 3년 이상)

주요 업무
- 신선식품 커머스 앱의 주문·결제·재구매 경험 기획
- 데이터 기반 가설 수립과 A/B 실험 설계, 지표 관리
- 개발·디자인·물류팀과 협업하여 기능 출시 및 개선

자격 요건
- 커머스 또는 플랫폼 서비스 기획 경력 3년 이상
- SQL 등으로 직접 데이터를 확인하고 의사결정한 경험
- 이해관계자 조율과 문서화 역량

우대 사항
- 구독·재구매 서비스 기획 경험
- 물류/재고 연동 서비스 경험`,
      resume: `가상지원자 · 서비스 기획 5년

[경력] 오늘장보기 (2021.03 ~ 현재) 프로덕트 기획 매니저
- 정기배송 구독 서비스를 0→1로 기획, 출시 1년 만에 구독자 4만 명 확보
- 장바구니 재구매 추천 기능 기획: 재구매율 18% → 27% 개선 (A/B 실험 6주, 표본 12만 명)
- 결제 단계 간소화로 결제 이탈률 32%에서 21%로 감소
- 물류팀과 품절 대체상품 정책 수립, CS 문의 월 1,200건 감소

[경력] 스몰커머스랩 (2019.07 ~ 2021.02) 서비스 기획자
- 판매자 어드민 개편, 상품 등록 시간 평균 9분 → 4분 단축
- 주간 지표 대시보드 구축(SQL·Looker), 팀 의사결정 회의 체계화

[역량] SQL, GA4, Amplitude, Figma, Jira`,
      portfolio: `[포트폴리오] 정기배송 구독 서비스 0→1
- 문제: 신선식품 재구매 주기가 불규칙해 이탈이 많음
- 가설: 배송 주기를 고객이 직접 고르면 유지율이 높아질 것
- 실행: 주기 선택(1·2·4주), 건너뛰기, 품목 교체 기능 MVP 8주 출시
- 결과: 3개월 유지율 61%, 구독 고객 객단가 일반 고객 대비 1.6배
- 회고: 초기에는 물류 용량을 과소평가해 2주간 배송 지연이 발생했고, 이후 주문 마감 시간을 조정해 해결`,
    },
  },
  en: {
    company: 'GreenMart',
    role: 'Product Manager',
    years: 5,
    docs: {
      jd: `GreenMart, Product Manager (3+ years)

Responsibilities
- Own ordering, checkout and repeat-purchase experiences in our grocery app
- Form data-driven hypotheses, design A/B tests and track metrics
- Ship features with engineering, design and logistics

Requirements
- 3+ years of product management in commerce or platforms
- Hands-on data skills (SQL) used for decisions
- Strong stakeholder management and writing

Nice to have
- Subscription / repeat-purchase products
- Logistics or inventory integrations`,
      resume: `Sample Candidate · Product Manager, 5 years

FreshDaily (Mar 2021 – present) Product Manager
- Launched a grocery subscription from zero; 40,000 subscribers in the first year
- Repeat-purchase recommendations lifted repurchase rate from 18% to 27% (6-week A/B test, 120k users)
- Simplified checkout, cutting drop-off from 32% to 21%
- Co-designed an out-of-stock substitution policy with logistics, reducing support tickets by 1,200/month

SmallCommerce Lab (Jul 2019 – Feb 2021) Product Planner
- Rebuilt the seller admin, reducing listing time from 9 to 4 minutes
- Built a weekly metrics dashboard (SQL, Looker)

Skills: SQL, GA4, Amplitude, Figma, Jira`,
      portfolio: `Case study: Subscription 0→1
- Problem: irregular grocery repurchase cycles caused churn
- Hypothesis: letting customers choose the cadence improves retention
- Execution: cadence picker (1/2/4 weeks), skip, swap items; MVP in 8 weeks
- Result: 61% 3-month retention; subscriber AOV 1.6x non-subscribers
- Retro: we underestimated logistics capacity and had a 2-week delay; fixed by moving the order cutoff`,
    },
  },
};
