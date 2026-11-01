// End-to-end smoke (fake LLM mode). Usage: npm run build && npm run e2e
// Starts `wrangler pages dev dist` unless BASE_URL is set.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('@playwright/test')); }

const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
let server;
let BASE = process.env.BASE_URL;
if (!BASE) {
  BASE = 'http://localhost:8799';
  server = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', '8799', '--log-level', 'error', '--binding', 'TURNSTILE_SITEKEY=', '--persist-to', mkdtempSync(join(tmpdir(), 'iv-e2e-'))], { stdio: 'ignore', detached: true, env: { ...process.env, CI: '1' } });
  // Kill the whole process group (npx → wrangler → workerd) on any exit, so no stale server keeps the port.
  const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch {} };
  process.on('exit', stop);
  process.on('SIGINT', () => process.exit(130));
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + '/api/config')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runFlow(browser, { name, viewport, lang, mode, panel }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/?fast=1`);
  await page.getByTestId(`lang-${lang}`).click();
  await page.getByTestId('fill-sample').click();
  await page.getByTestId('privacy-ok').check();
  await page.getByTestId('to-panel').click();
  await page.getByTestId(`count-${panel}`).click();
  if (panel > 1) await page.getByTestId('personality-1').selectOption('pressure');
  await page.getByTestId(`mode-${mode}`).click();
  await page.getByTestId('start-interview').click();
  await page.getByTestId('room').waitFor({ timeout: 20000 });
  await sleep(1500);
  await page.screenshot({ path: `${OUT}${name}-room.png` });
  let answers = 0;
  let sawFeedback = false;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (await page.getByTestId('report').isVisible().catch(() => false)) break;
    const quick = page.getByTestId('icebreak-reply');
    if (await quick.isVisible().catch(() => false)) { await quick.click({ timeout: 2000 }).catch(() => {}); continue; }
    const next = page.getByTestId('feedback-next');
    if (await next.isVisible().catch(() => false)) {
      if (!sawFeedback) await page.screenshot({ path: `${OUT}${name}-feedback.png` });
      sawFeedback = true; await next.click({ timeout: 2000 }).catch(() => {}); continue;
    }
    const input = page.getByTestId('answer-input');
    if (await input.isEnabled().catch(() => false)) {
      answers++;
      const text = lang === 'ko'
        ? (answers % 3 === 0 ? '음 잘 모르겠습니다' : `제 기여는 실험 설계와 데이터 분석이었습니다. ${answers * 3}주 동안 실험 ${answers + 10}건을 진행해 전환율을 2.1%에서 3.${answers}%로 올렸고, 그 결과 매출이 ${answers * 5}% 늘었습니다. 다만 표본이 작아 2차 검증을 거쳤습니다.`)
        : (answers % 3 === 0 ? 'um I am not sure' : `My main contribution was experiment design. Over ${answers * 3} weeks we ran ${answers + 10} tests and lifted conversion from 2.1% to 3.${answers}%, which grew revenue by ${answers * 5}%. The sample was small, so we validated it twice.`);
      await input.fill(text);
      await page.getByTestId('answer-submit').click({ timeout: 3000 }).catch(() => {});
      continue;
    }
    const skip = page.getByTestId('skip-speech');
    if (await skip.isVisible().catch(() => false)) await skip.click({ timeout: 800 }).catch(() => {});
    await sleep(150);
  }
  const reached = await page.getByTestId('report').isVisible().catch(() => false);
  await sleep(800);
  await page.screenshot({ path: `${OUT}${name}-report.png`, fullPage: true });
  await page.close();
  return { name, reached, answers, sawFeedback, errors };
}

// Regression: two uploads finishing close together must both land (stale-closure bug).
async function uploadBoth(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/?fast=1`);
  await page.getByTestId('lang-ko').click();
  const files = page.locator('input[type=file]');
  await files.nth(1).setInputFiles(new URL('./fixtures/resume.docx', import.meta.url).pathname);
  await files.nth(2).setInputFiles(new URL('./fixtures/portfolio.pdf', import.meta.url).pathname);
  await sleep(5000);
  const lens = [];
  for (const i of [1, 2]) lens.push((await page.locator('.doc-field').nth(i).locator('textarea').inputValue()).length);
  await page.close();
  return lens;
}

let failed = false;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const lens = await uploadBoth(browser);
  const upOk = lens.every((n) => n > 200);
  console.log(`${upOk ? 'PASS' : 'FAIL'} upload-both: resume=${lens[0]} portfolio=${lens[1]}`);
  if (!upOk) failed = true;
  const flows = [
    { name: 'ko-practice-pc', viewport: { width: 1440, height: 900 }, lang: 'ko', mode: 'practice', panel: 3 },
    { name: 'en-real-mobile', viewport: { width: 390, height: 844 }, lang: 'en', mode: 'real', panel: 2 },
  ];
  for (const f of flows) {
    const r = await runFlow(browser, f);
    const ok = r.reached && r.answers >= 9 && r.errors.length === 0 && (f.mode === 'practice' ? r.sawFeedback : !r.sawFeedback);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${r.name}: report=${r.reached} answers=${r.answers} feedback=${r.sawFeedback} errors=${JSON.stringify(r.errors)}`);
    if (!ok) failed = true;
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
