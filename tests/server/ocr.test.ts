import { describe, it, expect } from 'vitest';
import { selectFreeModels } from '../../functions/_lib/models';
import { handleOcr } from '../../functions/api/ocr';
import { memKV } from './memkv';

const PNG = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://app.example/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://app.example', 'CF-Connecting-IP': '1.2.3.4', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('vision model selection', () => {
  it('keeps only :free models that take images and return text', () => {
    const M = (id: string, inp: string[]) => ({ id, context_length: 64000, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: inp, output_modalities: ['text'] } });
    expect(selectFreeModels([M('a/text-only:free', ['text']), M('b/vl:free', ['text', 'image']), M('c/vl-paid', ['text', 'image'])], [], { vision: true })).toEqual(['b/vl:free']);
  });
});

describe('/api/ocr', () => {
  it('returns demo text in fake mode', async () => {
    const r = await handleOcr(post({ image: PNG, kind: 'resume', lang: 'ko' }), { IV_KV: memKV() } as never);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean; data: { text: string } };
    expect(j.ok).toBe(true);
    expect(j.data.text.length).toBeGreaterThan(20);
  });
  it('rejects non-image payloads and oversized bodies', async () => {
    const env = { IV_KV: memKV() } as never;
    expect((await handleOcr(post({ image: 'data:text/html;base64,AAAA', kind: 'resume', lang: 'ko' }), env)).status).toBe(400);
    expect((await handleOcr(post({ image: 'data:image/png;base64,' + 'A'.repeat(2_700_000), kind: 'resume', lang: 'ko' }), env)).status).toBe(413);
  });
  it('rejects foreign origins', async () => {
    const r = await handleOcr(post({ image: PNG, kind: 'jd', lang: 'ko' }, { Origin: 'https://evil.example' }), { IV_KV: memKV() } as never);
    expect(r.status).toBe(403);
  });
  it('caps images per IP per day', async () => {
    const env = { IV_KV: memKV(), DAILY_OCR_PER_IP: '2' } as never;
    expect((await handleOcr(post({ image: PNG, kind: 'resume', lang: 'ko' }), env)).status).toBe(200);
    expect((await handleOcr(post({ image: PNG, kind: 'resume', lang: 'ko' }), env)).status).toBe(200);
    const third = await handleOcr(post({ image: PNG, kind: 'resume', lang: 'ko' }), env);
    expect(third.status).toBe(429);
    expect(await third.json()).toEqual({ reason: 'ocr' });
  });
  it('sends the image to a vision model and returns its transcription', async () => {
    const kv = memKV();
    await kv.put('models:vision:v1', JSON.stringify({ at: Date.now(), ids: ['v/vl:free'] }));
    let sent: unknown = null;
    const f = (async (_u: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"text":"한서윤 | 서비스기획 8년차\\n플레이티켓 (2021.04 ~ 현재)"}' } }] }));
    }) as unknown as typeof fetch;
    const r = await handleOcr(post({ image: PNG, kind: 'resume', lang: 'ko' }), { IV_KV: kv, OPENROUTER_API_KEY: 'k' } as never, f);
    const j = (await r.json()) as { ok: boolean; data: { text: string }; model: string };
    expect(j.ok).toBe(true);
    expect(j.model).toBe('v/vl:free');
    expect(j.data.text).toContain('서비스기획 8년차');
    const parts = (sent as { messages: { content: unknown }[] }).messages.at(-1)!.content as { type: string }[];
    expect(parts.some((p) => p.type === 'image_url')).toBe(true);
  });
  it('reports fallback when the model returns no text', async () => {
    const kv = memKV();
    await kv.put('models:vision:v1', JSON.stringify({ at: Date.now(), ids: ['v/vl:free'] }));
    const f = (async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"text":""}' } }] }))) as unknown as typeof fetch;
    const r = await handleOcr(post({ image: PNG, kind: 'resume', lang: 'ko' }), { IV_KV: kv, OPENROUTER_API_KEY: 'k' } as never, f);
    expect(await r.json()).toEqual({ ok: false, fallback: true });
  });
});
