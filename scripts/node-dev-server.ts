// Local harness: serves dist/ and runs the same Pages Functions handlers under Node.
// Useful where workerd cannot reach the network (e.g. behind an HTTP proxy):
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/node-dev-server.ts   (reads .dev.vars, port 8796)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { handleSession } from '../functions/api/session';
import { handlePlan } from '../functions/api/plan';
import { handleScore } from '../functions/api/score';
import { handleReport } from '../functions/api/report';
import { handleOcr } from '../functions/api/ocr';
import { isFake } from '../functions/_lib/env';

const root = join(import.meta.dirname, '..');
const vars = Object.fromEntries(
  (existsSync(join(root, '.dev.vars')) ? readFileSync(join(root, '.dev.vars'), 'utf8') : '')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const store = new Map<string, string>();
// Honors expirationTtl like Cloudflare KV, so model health flags and quota marks expire here too.
const expires = new Map<string, number>();
const live = (k: string) => (expires.has(k) && expires.get(k)! <= Date.now() ? (store.delete(k), expires.delete(k), false) : store.has(k));
const kv = {
  get: async (k: string, t?: unknown) => { if (!live(k)) return null; const v = store.get(k)!; return t === 'json' ? JSON.parse(v) : v; },
  put: async (k: string, v: string, o?: { expirationTtl?: number }) => { store.set(k, v); if (o?.expirationTtl) expires.set(k, Date.now() + o.expirationTtl * 1000); else expires.delete(k); },
  delete: async (k: string) => { store.delete(k); expires.delete(k); },
};
const env = { ...vars, IV_KV: kv, DAILY_DEVICE_INTERVIEWS: '50', DAILY_IP_INTERVIEWS: '50' } as never;
const LOG = process.env.LLM_LOG === '1';
const realFetch = globalThis.fetch;
const loggingFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const t0 = Date.now();
  const r = await realFetch(input, init);
  if (LOG && String(input).includes('chat/completions')) {
    const extra = r.ok ? '' : ` ${(await r.clone().text().catch(() => '')).slice(0, 200)}`;
    console.log(`[llm] ${new Date().toISOString().slice(11, 19)} ${JSON.parse(String(init?.body)).model} -> ${r.status} in ${Date.now() - t0}ms${extra}`);
  }
  return r;
}) as typeof fetch;
globalThis.fetch = loggingFetch;
const handlers: Record<string, (req: Request, env: never) => Promise<Response>> = { '/api/session': handleSession, '/api/plan': handlePlan, '/api/score': handleScore, '/api/report': handleReport, '/api/ocr': handleOcr };
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 8796);
createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`);
  if (url.pathname === '/api/config') return void res.end(JSON.stringify({ turnstileSiteKey: '', fake: isFake(env) }));
  if (url.pathname === '/api/event') return void res.end('{"ok":true}');
  const h = handlers[url.pathname];
  if (h) {
    const body = await new Promise<string>((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b)); });
    const r = await h(new Request(url, { method: req.method, headers: req.headers as HeadersInit, body: body || undefined }), env);
    res.writeHead(r.status, { 'Content-Type': 'application/json' });
    return void res.end(await r.text());
  }
  let f = join(root, 'dist', url.pathname);
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(root, 'dist', 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(port, () => console.log(`node dev server on http://localhost:${port} (fake=${isFake(env)})`));
