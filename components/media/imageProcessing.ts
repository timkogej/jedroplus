// Turning a photo from the user's phone or computer into a small, cropped
// image that loads fast on the booking page.

export type ImageShape = 'round' | 'wide';

/** Width / height of the crop frame and size of the saved image. */
export const SHAPES: Record<ImageShape, { aspect: number; width: number; height: number }> = {
  // Staff: square, shown as a circle. 512 px is sharp at 2x up to ~256 px.
  round: { aspect: 1, width: 512, height: 512 },
  // Services: 4:3, the booking designs crop it further where they need to.
  wide: { aspect: 4 / 3, width: 1024, height: 768 },
};

/** Smallest side we accept, so the result is not blurry. */
export const MIN_SOURCE_SIDE = 240;

export function loadImage(file: Blob): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Draws the part of `img` given by the source rectangle onto a canvas of the
 * shape's size and encodes it as webp (jpeg where the browser cannot write
 * webp). Lowers quality until the file is under ~300 KB.
 */
export async function renderCrop(
  img: HTMLImageElement,
  source: { x: number; y: number; width: number; height: number },
  shape: ImageShape
): Promise<Blob> {
  const target = SHAPES[shape];
  // Never upscale: a small source stays at its own resolution.
  const scale = Math.min(1, source.width / target.width);
  const width = Math.max(1, Math.round(target.width * scale));
  const height = Math.max(1, Math.round(target.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // A transparent PNG would turn black as jpeg; give it a white base.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, source.x, source.y, source.width, source.height, 0, 0, width, height);

  const LIMIT = 300 * 1024;
  let last: Blob | null = null;
  for (const quality of [0.86, 0.78, 0.68]) {
    let blob = await toBlob(canvas, 'image/webp', quality);
    // Older Safari silently returns a PNG for webp.
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
    if (!blob) continue;
    last = blob;
    if (blob.size <= LIMIT) return blob;
  }
  if (!last) throw new Error('encode');
  return last;
}
