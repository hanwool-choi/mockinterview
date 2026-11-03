import { describe, expect, it } from 'vitest';
import { groundedQuestion } from '../../functions/_lib/question';

const resume = `[경력] 오늘장보기 (2021.03 ~ 현재)
- 장바구니 재구매 추천 기능 기획: 재구매율 18% → 27% 개선 (A/B 실험 6주, 표본 12만 명)
- 결제 단계 간소화로 결제 이탈률 32%에서 21%로 감소`;

describe('groundedQuestion', () => {
  it('rejects a bare number thrown without its context', () => {
    expect(groundedQuestion('18% → 27% 개선에서 기여한 부분은 무엇인가요?', resume, 'ko')).toBe(false);
    expect(groundedQuestion('21%로 줄었다고 하셨는데, 본인 역할은요?', resume, 'ko')).toBe(false);
  });
  it('accepts the same number with where it came from', () => {
    expect(groundedQuestion('오늘장보기에서 장바구니 재구매 추천으로 재구매율을 18%에서 27%로 올리셨다고 했는데, 본인이 직접 정한 건 무엇이었나요?', resume, 'ko')).toBe(true);
    expect(groundedQuestion('결제 단계를 줄여 이탈률을 32%에서 21%로 낮추셨는데, 어떤 단계를 왜 빼셨나요?', resume, 'ko')).toBe(true);
  });
  it('rejects figures that appear nowhere in the documents or answers', () => {
    expect(groundedQuestion('오늘장보기 결제 이탈률을 35% 개선하셨다고 했는데, 본인 몫은요?', resume, 'ko')).toBe(false);
  });
  it('questions without figures pass', () => {
    expect(groundedQuestion('이번엔 협업 쪽을 여쭤볼게요. 물류팀과 의견이 갈렸을 때 어떻게 정리하셨나요?', resume, 'ko')).toBe(true);
  });
  it('english', () => {
    const en = '- Simplified checkout at FreshDaily, cutting drop-off from 32% to 21%';
    expect(groundedQuestion('What was your part in going from 32% to 21%?', en, 'en')).toBe(false);
    expect(groundedQuestion('You simplified checkout and cut drop-off from 32% to 21%. Which steps did you remove, and why?', en, 'en')).toBe(true);
  });
});

describe('score endpoint uses the check', () => {
  it('drops a rewritten next question that throws a bare figure, keeping the draft', async () => {
    const { usableNext } = await import('../../functions/api/score');
    const body = {
      lang: 'ko', answer: '결제 단계를 5단계에서 3단계로 줄였습니다.', thread: [], history: [], jdFacts: '',
      question: { text: '자기소개 부탁드립니다.' }, evidence: [{ id: 'resume#1', kind: 'resume', text: resume }],
      next: { stage: 'experience', askedBy: 'a', draft: '오늘장보기에 계실 때 "결제 단계 간소화로 결제 이탈률 32%에서 21%로 감소"라고 적어 주셨는데요.', intent: '기여' },
    } as never;
    expect(usableNext(body, { text: '21%로 줄인 데 기여한 부분은 무엇인가요?', intent: 'x' })).toBeNull();
    expect(usableNext(body, { text: '말씀하신 결제 단계 축소 얘기가 나와서요. 이탈률을 32%에서 21%로 낮추실 때 어떤 단계를 왜 빼셨나요?', intent: 'x' })?.text).toContain('32%');
  });
});

describe('next question stays on its own topic', () => {
  it('drops a next question that repeats the follow-up, or bundles many asks into a long one', async () => {
    const { usableNext } = await import('../../functions/api/score');
    const body = {
      lang: 'ko', answer: '물류 용량이 부족해 주문 마감 시간을 앞당겼습니다.', thread: [], history: [], jdFacts: '',
      question: { text: '가장 어려웠던 문제는요?' }, evidence: [],
      next: { stage: 'experience', askedBy: 'a', draft: '본인 몫이라고 할 수 있는 부분과 그 근거는 무엇인가요?', intent: '기여' },
    } as never;
    const fu = "말씀하신 '물류 용량' 문제가 구체적으로 어떤 상황이었는지, 주문 마감 시간을 앞당긴 이유를 설명해 주시겠어요?";
    expect(usableNext(body, { text: "말씀하신 '물류 용량' 문제가 어떤 상황이었는지, 마감 시간을 앞당긴 이유는요?", intent: '' }, fu)).toBeNull();
    expect(usableNext(body, { text: '가'.repeat(170) + '?', intent: '' })).toBeNull();
    expect(usableNext(body, { text: '물류 얘기 잘 들었습니다. 이번엔 기여도를 여쭤볼게요. 그 프로젝트에서 본인 몫은 무엇이었나요?', intent: '' }, fu)?.text).toContain('본인 몫');
  });
});

describe('next question keeps the planned topic', () => {
  it('drops a rewrite that stays on the current topic instead of the draft', async () => {
    const { usableNext } = await import('../../functions/api/score');
    const draft = `포트폴리오의 '정기배송 구독 서비스 0→1' 프로젝트에서 "3개월 유지율 61%, 구독 고객 객단가 일반 고객 대비 1.6배"라고 적어 주셨는데요. 그 결과를 내기까지 가장 어려웠던 문제는 무엇이었고, 어떻게 푸셨나요?`;
    const body = { lang: 'ko', answer: '추천 기능은 팀이 같이 만들었습니다.', thread: [], history: [], jdFacts: '', question: { text: 'q' }, evidence: [{ id: 'p', kind: 'portfolio', text: '결과: 3개월 유지율 61%' }], next: { stage: 'experience', askedBy: 'a', draft, intent: '' } } as never;
    expect(usableNext(body, { text: "말씀하신 '장바구니 재구매 추천 기능'의 결과를 어떻게 측정하셨는지, 구체적인 지표와 측정 방식을 설명해 주시겠어요?", intent: '' })).toBeNull();
    expect(usableNext(body, { text: '추천 기능 얘기 잘 들었습니다. 이번엔 포트폴리오의 정기배송 구독 프로젝트를 여쭤볼게요. 유지율 61%를 내기까지 가장 어려웠던 문제는 뭐였나요?', intent: '' })).not.toBeNull();
  });
});
