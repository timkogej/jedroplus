/**
 * Generates app/icon.png (512×512) and app/apple-icon.png (180×180)
 * from public/brand/logo.png.
 *
 * The logo is trimmed of excess transparent/white space, then placed
 * centred on a square transparent canvas with 10% padding on each side.
 *
 * Usage:  node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SOURCE = path.join(root, 'public', 'brand', 'logo.png');
const ICON = path.join(root, 'app', 'icon.png');
const APPLE = path.join(root, 'app', 'apple-icon.png');

async function makeIcon(dest, size) {
  const padding = Math.round(size * 0.10); // 10% padding on each side
  const inner = size - padding * 2;

  // 1. Trim transparent/white edges from source
  const trimmed = await sharp(SOURCE)
    .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 }, threshold: 10 })
    .toBuffer();

  // 2. Resize trimmed image to fit the inner square (maintain aspect ratio)
  const resized = await sharp(trimmed)
    .resize(inner, inner, { fit: 'inside', withoutEnlargement: false })
    .toBuffer();

  const resizedMeta = await sharp(resized).metadata();
  const left = Math.round((size - resizedMeta.width) / 2);
  const top  = Math.round((size - resizedMeta.height) / 2);

  // 3. Composite onto transparent square canvas
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(dest);

  console.log(`✓ ${dest} (${size}×${size})`);
}

await makeIcon(ICON,  512);
await makeIcon(APPLE, 180);
console.log('Done.');
