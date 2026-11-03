import { describe, it, expect } from 'vitest';
import { jdFacts } from '../../src/docs/jd';

const JD = `[NHN Link] 서비스기획 담당
고객을 위한 최고의 티켓예매 서비스를 제공하기 위해 앞장서는 사람들이 모인 곳입니다.
· 국내 최초의 티켓팅 업체

주요업무
· 티켓링크 서비스 신규 기능 및 정책 기획
· 간편결제·결제수단 연동 기획

자격요건
· 서비스기획 관련 경력을 6년 이상 보유하신 분
· 백엔드 시스템 구조(API, 데이터 흐름)를 이해하고 개발자와 스펙 단위로 협업이 가능하신 분

우대사항
· 결제수단·PG 연동 기획 경험이 있으신 분

전형절차: 서류전형 > 1차 실무면접 > 2차 임원면접`;

describe('jdFacts', () => {
  it('keeps duties, requirements and preferred lines under their headings, nothing else', () => {
    const f = jdFacts(JD);
    expect(f).toContain('[주요업무] 티켓링크 서비스 신규 기능 및 정책 기획');
    expect(f).toContain('[자격요건] 서비스기획 관련 경력을 6년 이상 보유하신 분');
    expect(f).toContain('[우대사항] 결제수단·PG 연동 기획 경험이 있으신 분');
    expect(f).not.toContain('전형절차');
    expect(f).not.toContain('국내 최초');
  });
  it('stays within the character budget', () => {
    expect(jdFacts(JD.repeat(20), 400).length).toBeLessThanOrEqual(400);
  });
  it('falls back to the first lines when there are no headings', () => {
    expect(jdFacts('We build payments.\nYou will own checkout.\n', 200)).toContain('You will own checkout.');
  });
});
