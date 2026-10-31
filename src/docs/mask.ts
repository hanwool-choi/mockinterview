import type { Lang } from '../../shared/schema';

const LABELS = {
  ko: { email: '[이메일]', phone: '[전화번호]', id: '[주민번호]', address: '[주소]', name: '[이름]' },
  en: { email: '[email]', phone: '[phone]', id: '[id]', address: '[address]', name: '[name]' },
} as const;

const RULES: { key: keyof (typeof LABELS)['ko']; re: RegExp }[] = [
  { key: 'email', re: /[\w.+-]+@[\w-]+(\.[\w-]+)+/g },
  { key: 'id', re: /\b\d{6}-[1-8]\d{6}\b/g },
  { key: 'phone', re: /\+\d{1,3}[\s-]?\(?\d{1,4}\)?(?:[\s-]?\d{2,4}){2,3}/g },
  { key: 'phone', re: /\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g },
  { key: 'address', re: /[가-힣]+(?:특별시|광역시|시|도)\s+[가-힣]+(?:구|군|시)\s+[가-힣0-9]+(?:로|길)\s?\d+(?:-\d+)?/g },
  { key: 'address', re: /\b\d+\s+[A-Z][\w]*(?:\s+[A-Z][\w]*)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)\b\.?/g },
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function maskPII(text: string, opts: { name?: string; lang: Lang }): { text: string; hits: number } {
  const L = LABELS[opts.lang];
  let hits = 0;
  let out = text;
  for (const { key, re } of RULES) {
    out = out.replace(re, () => {
      hits++;
      return L[key];
    });
  }
  const name = opts.name?.trim();
  if (name && name.length >= 2) {
    out = out.replace(new RegExp(escapeRe(name), 'g'), () => {
      hits++;
      return L.name;
    });
  }
  return { text: out, hits };
}
