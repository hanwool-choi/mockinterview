import { describe, it, expect } from 'vitest';
import { signDevice, verifyDevice, checkOrigin, kstDay } from '../../functions/_lib/security';

describe('device token', () => {
  it('round-trips and rejects tampering', async () => {
    const t = await signDevice('sec', 'dev1', '2026-10-31');
    expect(await verifyDevice('sec', t)).toBe('dev1');
    expect(await verifyDevice('sec', t.replace('dev1', 'dev2'))).toBeNull();
    expect(await verifyDevice('other', t)).toBeNull();
    expect(await verifyDevice('sec', 'garbage')).toBeNull();
  });
});

describe('checkOrigin / kstDay', () => {
  it('accepts same-origin and missing origin, rejects foreign', () => {
    const mk = (o?: string) => new Request('https://app.example/api/x', { method: 'POST', headers: o ? { Origin: o } : {} });
    expect(checkOrigin(mk('https://app.example'), {} as never)).toBe(true);
    expect(checkOrigin(mk(), {} as never)).toBe(true);
    expect(checkOrigin(mk('https://evil.example'), {} as never)).toBe(false);
  });
  it('computes KST day (UTC+9)', () => {
    expect(kstDay(new Date('2026-10-31T15:30:00Z'))).toBe('2026-11-01');
  });
});
