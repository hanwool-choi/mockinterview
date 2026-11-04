import { describe, expect, it } from 'vitest';
import { preserved } from '../../functions/_lib/preserve';
import { handleStructure } from '../../functions/api/structure';
import { memKV } from './memkv';

const post = (body: unknown) =>
  new Request('https://app.example/api/structure', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://app.example', 'CF-Connecting-IP': '1.2.3.4' }, body: JSON.stringify(body) });

const scrambled = `기간 | 회사명 | 직위 | 담당업무 및 성과
정기배송 구독 서비스 0→1 기획, 출시 1년 만
2021.03 ~ 현재 오늘장보기 | 매니저 | 에 구독자 4만 명 확보. 장바구니 재구매 추천
기능 기획으로 재구매율 18% → 27% 개선`;
const tidy = `[경력] 오늘장보기 (2021.03 ~ 현재) 매니저
- 정기배송 구독 서비스 0→1 기획, 출시 1년 만에 구독자 4만 명 확보.
- 장바구니 재구매 추천 기능 기획으로 재구매율 18% → 27% 개선`;

describe('preserved', () => {
  it('accepts a rearrangement with section labels and rejoined words', () => {
    expect(preserved(scrambled, tidy).ok).toBe(true);
  });
  it('rejects an invented figure', () => {
    expect(preserved(scrambled, tidy.replace('27%', '35%'))).toMatchObject({ ok: false });
  });
  it('rejects dropped content (a summary)', () => {
    expect(preserved(scrambled, '[경력] 오늘장보기 (2021.03 ~ 현재) 매니저\n- 구독 서비스 기획')).toMatchObject({ ok: false });
  });
  it('rejects added text', () => {
    expect(preserved(scrambled, tidy + '\n- 고객 중심의 사고로 데이터 기반 의사결정을 주도하며 팀의 성장에 크게 기여한 핵심 인재로 인정받음. 사내 혁신상 수상 및 리더십 교육 이수, 신규 사업 기획 참여 다수').ok).toBe(false);
  });
});

const gem = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text }) } }], usage: { prompt_tokens: 300, completion_tokens: 150 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('/api/structure', () => {
  it('returns the text unchanged in demo mode', async () => {
    const r = await handleStructure(post({ text: scrambled, kind: 'resume', lang: 'ko' }), { IV_KV: memKV() } as never);
    expect(await r.json()).toMatchObject({ ok: true, data: { text: scrambled } });
  });
  it('returns the model rearrangement when it keeps the facts', async () => {
    const env = { IV_KV: memKV(), GEMINI_API_KEY: 'g', GEMINI_MODELS: 'm1' } as never;
    const r = await handleStructure(post({ text: scrambled, kind: 'resume', lang: 'ko' }), env, (async () => gem(tidy)) as never);
    expect(await r.json()).toMatchObject({ ok: true, data: { text: tidy } });
  });
  it('falls back (client keeps its text) when every reply changes the facts', async () => {
    const env = { IV_KV: memKV(), GEMINI_API_KEY: 'g', GEMINI_MODELS: 'm1' } as never;
    const r = await handleStructure(post({ text: scrambled, kind: 'resume', lang: 'ko' }), env, (async () => gem(tidy.replace('27%', '35%'))) as never);
    expect(await r.json()).toMatchObject({ ok: false, fallback: true });
  });
  it('rejects bad input and caps requests per IP per day', async () => {
    const env = { IV_KV: memKV(), DAILY_STRUCTURE_PER_IP: '2' } as never;
    expect((await handleStructure(post({ text: '', kind: 'resume', lang: 'ko' }), env)).status).toBe(400);
    expect((await handleStructure(post({ text: 'x', kind: 'jd', lang: 'ko' }), env)).status).toBe(400);
    expect((await handleStructure(post({ text: 'x'.repeat(20_001), kind: 'resume', lang: 'ko' }), env)).status).toBe(400);
    for (let i = 0; i < 2; i++) expect((await handleStructure(post({ text: scrambled, kind: 'resume', lang: 'ko' }), env)).status).toBe(200);
    expect((await handleStructure(post({ text: scrambled, kind: 'resume', lang: 'ko' }), env)).status).toBe(429);
  });
});
