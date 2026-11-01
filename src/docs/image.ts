/** Browser-side image preparation for /api/ocr: downscale and re-encode as JPEG under the request limit. */

export const MAX_SIDE = 1600;
export const MAX_DATA_URL = 2_400_000; // LIMITS.ocrBytes is 2.6MB including JSON overhead
export const MAX_PDF_PAGES = 5;
export const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

export function isImageFile(f: { name: string; type: string }): boolean {
  return /^image\/(png|jpeg|webp)$/.test(f.type) || IMAGE_EXT.test(f.name);
}

/** Fit (w, h) inside a square of maxSide, never upscaling. */
export function fitSize(w: number, h: number, maxSide = MAX_SIDE): { w: number; h: number } {
  const k = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Draws a source onto a white canvas at the fitted size and encodes JPEG, lowering quality until it fits. */
export function encodeJpeg(src: CanvasImageSource, w: number, h: number): string {
  let size = fitSize(w, h);
  for (let attempt = 0; attempt < 6; attempt++) {
    const c = document.createElement('canvas');
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.72, 0.6]) {
      const url = c.toDataURL('image/jpeg', q);
      if (url.length <= MAX_DATA_URL) return url;
    }
    size = fitSize(size.w, size.h, Math.round(Math.max(size.w, size.h) * 0.75));
  }
  throw new Error('image too large');
}

export async function imageFileToJpeg(file: Blob): Promise<string> {
  const bmp = await createImageBitmap(file);
  try {
    return encodeJpeg(bmp, bmp.width, bmp.height);
  } finally {
    bmp.close();
  }
}
