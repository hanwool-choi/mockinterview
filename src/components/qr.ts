import qrcode from 'qrcode-generator';

/** One SVG path for the dark modules of a QR code (with a 4-module quiet zone), so React renders it without raw HTML. */
export function qrPath(text: string): { size: number; d: string } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const pad = 4;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + pad} ${r + pad}h1v1h-1z`;
  return { size: n + pad * 2, d };
}

/** Phones and tablets open the KakaoPay link in the app; anything else gets a QR to scan with the phone. */
export function opensOnPhone(ua: string, coarsePointer: boolean): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (coarsePointer && /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome/.test(ua));
}
