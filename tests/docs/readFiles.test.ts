import { describe, expect, it, vi } from 'vitest';
import { readFiles, type ReadDeps } from '../../src/docs/readFiles';
import { fitSize, isImageFile } from '../../src/docs/image';

const LONG = '이력서 본문 '.repeat(60).trim();
function deps(over: Partial<ReadDeps> = {}): ReadDeps {
  return {
    extractText: vi.fn(async (f: File) => (f.name.includes('scan') ? ' ' : LONG)),
    pdfPagesToJpeg: vi.fn(async () => ['data:image/jpeg;base64,p1', 'data:image/jpeg;base64,p2']),
    imageFileToJpeg: vi.fn(async (f: Blob) => `data:image/jpeg;base64,${(f as File).name}`),
    ocr: vi.fn(async (img: string) => ({ ok: true as const, text: `OCR(${img.split(',')[1]})` })),
    ...over,
  };
}
const file = (name: string, type = '') => new File(['x'], name, { type });

describe('readFiles', () => {
  it('joins text files and OCR results in the order given', async () => {
    const d = deps();
    const r = await readFiles([file('a.png', 'image/png'), file('cv.docx'), file('b.jpg', 'image/jpeg')], d);
    expect(r.text).toBe(`OCR(a.png)\n\n${LONG}\n\nOCR(b.jpg)`);
    expect(r.images).toBe(2);
    expect(r.failed).toBe(0);
  });

  it('renders a scanned PDF to pages and reads each page', async () => {
    const d = deps();
    const r = await readFiles([file('scan.pdf', 'application/pdf')], d);
    expect(d.pdfPagesToJpeg).toHaveBeenCalledOnce();
    expect(r.text).toBe('OCR(p1)\n\nOCR(p2)');
    expect(r.images).toBe(2);
  });

  it('keeps a text PDF as text without OCR', async () => {
    const d = deps();
    const r = await readFiles([file('cv.pdf', 'application/pdf')], d);
    expect(d.ocr).not.toHaveBeenCalled();
    expect(r.text).toBe(LONG);
  });

  it('stops calling OCR after the daily limit and counts failures', async () => {
    const ocr = vi.fn().mockResolvedValueOnce({ ok: false, reason: 'error' }).mockResolvedValueOnce({ ok: false, reason: 'quota' });
    const d = deps({ ocr });
    const r = await readFiles([file('1.png', 'image/png'), file('2.png', 'image/png'), file('3.png', 'image/png')], d);
    expect(ocr).toHaveBeenCalledTimes(2);
    expect(r.quota).toBe(true);
    expect(r.failed).toBe(3);
    expect(r.text).toBe('');
  });

  it('reports progress per image', async () => {
    const seen: string[] = [];
    await readFiles([file('1.png', 'image/png'), file('2.webp', 'image/webp')], deps(), (i, n) => seen.push(`${i}/${n}`));
    expect(seen).toEqual(['1/2', '2/2']);
  });
});

describe('image helpers', () => {
  it('fits the long side without upscaling', () => {
    expect(fitSize(3200, 1600)).toEqual({ w: 1600, h: 800 });
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 });
  });
  it('recognises image files by type or extension', () => {
    expect(isImageFile({ name: 'a.PNG', type: '' })).toBe(true);
    expect(isImageFile({ name: 'a.pdf', type: 'application/pdf' })).toBe(false);
  });
});
