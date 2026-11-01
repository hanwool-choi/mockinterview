import { isLikelyScanned } from './chunk';
import { isImageFile } from './image';

export type OcrResult = { ok: true; text: string } | { ok: false; reason: 'quota' | 'error' };
export type ReadDeps = {
  extractText: (f: File) => Promise<string>;
  pdfPagesToJpeg: (f: File) => Promise<string[]>;
  imageFileToJpeg: (f: Blob) => Promise<string>;
  ocr: (image: string) => Promise<OcrResult>;
};
export type ReadResult = { text: string; images: number; failed: number; quota: boolean };

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/**
 * Reads several files into one text, in the order given. Text files are read locally;
 * images and scanned PDF pages are read by the server's vision model, one image per request.
 */
export async function readFiles(files: File[], deps: ReadDeps, onProgress?: (done: number, total: number) => void): Promise<ReadResult> {
  // First pass: local text, or the images that need reading.
  const parts: ({ text: string } | { images: string[] })[] = [];
  for (const f of files) {
    if (isImageFile(f)) parts.push({ images: [await deps.imageFileToJpeg(f)] });
    else if (isPdf(f)) {
      const text = await deps.extractText(f);
      parts.push(isLikelyScanned(text) ? { images: await deps.pdfPagesToJpeg(f) } : { text });
    } else parts.push({ text: await deps.extractText(f) });
  }
  const total = parts.reduce((n, p) => n + ('images' in p ? p.images.length : 0), 0);
  const out: string[] = [];
  let done = 0;
  let failed = 0;
  let quota = false;
  for (const p of parts) {
    if ('text' in p) {
      if (p.text.trim()) out.push(p.text.trim());
      continue;
    }
    for (const img of p.images) {
      if (quota) {
        failed++;
        continue;
      }
      const r = await deps.ocr(img);
      onProgress?.(++done, total);
      if (r.ok) out.push(r.text.trim());
      else {
        failed++;
        if (r.reason === 'quota') quota = true;
      }
    }
  }
  return { text: out.join('\n\n'), images: total, failed, quota };
}
