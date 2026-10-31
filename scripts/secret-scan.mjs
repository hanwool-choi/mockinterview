// Fails (exit 1) if anything that looks like an API key is in tracked/untracked repo files or the build output.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PATTERNS = [/sk-or-v1-[0-9a-f]{20,}/, /sk-ant-[A-Za-z0-9_-]{20,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
const root = execSync('git rev-parse --show-toplevel').toString().trim();
const files = execSync('git ls-files --cached --others --exclude-standard', { cwd: root }).toString().split('\n').filter(Boolean).map((f) => join(root, f));

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const dist = resolve(import.meta.dirname, '..', 'dist');
if (existsSync(dist)) files.push(...walk(dist));

const hits = [];
for (const f of files) {
  let text;
  try {
    if (statSync(f).size > 5_000_000) continue;
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  for (const p of PATTERNS) if (p.test(text)) hits.push(`${f.replace(root + '/', '')}: ${p}`);
}
if (hits.length) {
  console.error('Secret scan FAILED:\n' + hits.join('\n'));
  process.exit(1);
}
console.log(`Secret scan passed (${files.length} files).`);
