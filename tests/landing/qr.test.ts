import { describe, expect, it } from 'vitest';
import { opensOnPhone, qrPath } from '../../src/components/qr';

describe('KakaoPay QR', () => {
  it('draws a QR for the transfer link with a quiet zone', () => {
    const { size, d } = qrPath('https://qr.kakaopay.com/Ej7lelIaG');
    expect(size).toBe(29 + 8); // version 3 (29 modules) plus a 4-module quiet zone on each side
    expect(d.startsWith('M4 4h1v1h-1z')).toBe(true); // top-left finder pattern corner is dark
  });
  it('phones open the link; desktops get the QR', () => {
    expect(opensOnPhone('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', true)).toBe(true);
    expect(opensOnPhone('Mozilla/5.0 (Linux; Android 14) Chrome Mobile', true)).toBe(true);
    expect(opensOnPhone('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17 Safari', true)).toBe(true); // iPadOS
    expect(opensOnPhone('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari', false)).toBe(false);
    expect(opensOnPhone('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17 Safari', false)).toBe(false);
  });
});
