import { describe, it, expect } from 'vitest';
import { handleSession } from '../../functions/api/session';
import { handleScore } from '../../functions/api/score';
import { handleReport } from '../../functions/api/report';
import { ScoreSchema, ReportSchema } from '../../shared/schema';
import { memKV } from './memkv';

const post = (path: string, body: unknown) =>
  new Request(`https://app.example${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://app.example' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

const ivs = [{ id: 'i1', role: 'hr', rank: 'lead', gender: 'female', personality: 'warm', seed: 3 }];
const question = { id: 'q1', stage: 'experience', askedBy: 'i1', text: 'MAU 20배 성장에서 본인 기여는?', intent: '기여도', mustHit: ['기여', '수치'], redFlags: ['우리가'], evidenceIds: ['resume#1'], answerOutline: 'o', followUpSeeds: ['a', 'b'] };

async function newSession(env: never) {
  const r = await handleSession(post('/api/session', { turnstileToken: 'x' }), env);
  expect(r.status).toBe(200);
  return (await r.json()) as { sid: string; deviceToken: string; ai: string };
}

describe('api (fake mode)', () => {
  it('session → score → report all succeed and validate', async () => {
    const env = { IV_KV: memKV(), DEVICE_SECRET: 's' } as never;
    const { sid, ai } = await newSession(env);
    expect(ai).toBe('on');
    const score = await handleScore(post('/api/score', { sid, lang: 'ko', question, answer: '제 기여는 40%였고 전환율을 3%p 올렸습니다.', thread: [], evidence: [], history: [], interviewers: ivs, followUpsUsed: 0, followUpLimit: 1 }), env);
    expect(score.status).toBe(200);
    const sj = (await score.json()) as { data: unknown };
    expect(ScoreSchema.safeParse(sj.data).success).toBe(true);

    const s = ScoreSchema.parse(sj.data);
    const report = await handleReport(post('/api/report', { sid, lang: 'ko', company: 'C', role: 'PM', interviewers: [{ id: 'i1', displayName: 'A', title: 'T' }], items: [{ questionId: 'q1', stage: 'experience', score: s }] }), env);
    const rj = (await report.json()) as { data: unknown };
    expect(ReportSchema.safeParse(rj.data).success).toBe(true);
  });
  it('rejects oversized score body with 413 and unknown sid with 401', async () => {
    const env = { IV_KV: memKV(), DEVICE_SECRET: 's' } as never;
    const { sid } = await newSession(env);
    const big = await handleScore(post('/api/score', { sid, answer: 'x'.repeat(50_000) }), env);
    expect(big.status).toBe(413);
    const bad = await handleScore(post('/api/score', { sid: 'nope', lang: 'ko', question, answer: 'a', thread: [], evidence: [], history: [], interviewers: ivs, followUpsUsed: 0, followUpLimit: 1 }), env);
    expect(bad.status).toBe(401);
  });
  it('suppresses followUp when limit is used up', async () => {
    const env = { IV_KV: memKV(), DEVICE_SECRET: 's' } as never;
    const { sid } = await newSession(env);
    const r = await handleScore(post('/api/score', { sid, lang: 'ko', question, answer: '음', thread: [], evidence: [], history: [], interviewers: ivs, followUpsUsed: 1, followUpLimit: 1 }), env);
    const j = (await r.json()) as { data: { followUp: unknown } };
    expect(j.data.followUp).toBeNull();
  });
  it('has no interview count limit: many sessions from one device all start', async () => {
    const env = { IV_KV: memKV(), DEVICE_SECRET: 's' } as never;
    const first = await newSession(env);
    for (let i = 0; i < 10; i++) {
      const r = await handleSession(post('/api/session', { turnstileToken: 'x', deviceToken: first.deviceToken }), env);
      expect(r.status).toBe(200);
    }
  });
  it('rejects foreign origin with 403', async () => {
    const env = { IV_KV: memKV(), DEVICE_SECRET: 's' } as never;
    const req = new Request('https://app.example/api/session', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' });
    expect((await handleSession(req, env)).status).toBe(403);
  });
});
