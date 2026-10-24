/**
 * Značka za push obvestila (Android jo pokaže v vrstici stanja).
 * Android upošteva samo prosojnost, zato je bel znak Jedro+ na prozornem.
 *
 *   node scripts/build-push-badge.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = await fs.readFile(path.join(root, 'public', 'brand', 'jedro-mark-white.svg'));
const SIZE = 96;
const MARK = 72;
const mark = await sharp(svg, { density: 600 }).resize(MARK, MARK, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: mark, left: (SIZE - MARK) / 2, top: (SIZE - MARK) / 2 }])
  .png()
  .toFile(path.join(root, 'public', 'brand', 'push-badge-96.png'));
console.log('public/brand/push-badge-96.png');
