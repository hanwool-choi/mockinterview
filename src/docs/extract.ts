import { encodeJpeg, MAX_PDF_PAGES, MAX_SIDE } from './image';
import { htmlToText, layoutText, type PdfItem } from './layout';

async function loadPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

/** Renders the first pages of a (scanned) PDF to JPEG data URLs for OCR. */
export async function pdfPagesToJpeg(file: File, maxPages = MAX_PDF_PAGES): Promise<string[]> {
  const doc = await loadPdf(file);
  const out: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: MAX_SIDE / Math.max(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    out.push(encodeJpeg(canvas, canvas.width, canvas.height));
  }
  return out;
}

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const doc = await loadPdf(file);
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // By position, not by the order the file stores text in (see layout.ts).
      pages.push(layoutText(content.items as PdfItem[], page.getViewport({ scale: 1 }).width));
    }
    return pages.join('\n\n');
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    // HTML keeps headings, lists and tables, which raw text drops.
    const r = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return htmlToText(r.value);
  }
  return file.text();
}
