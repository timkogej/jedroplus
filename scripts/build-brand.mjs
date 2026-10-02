/**
 * Builds every Jedro+ logo asset from lib/brand/geometry.ts.
 *
 *   node scripts/build-brand.mjs
 *
 * Writes:
 *   public/brand/*.svg        master vectors (the files you hand to anyone else)
 *   public/brand/png/*.png    raster exports at the usual sizes
 *   app/icon.png, app/apple-icon.png, app/favicon.ico
 *   public/android-icon-192.png, public/maskable-icon-512.png, public/icon.png
 *   public/og-image.png
 *
 * Nothing here is hand-maintained — edit the geometry module and re-run.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = path.join(root, 'public', 'brand');
const PNG = path.join(BRAND, 'png');

/* ── load the geometry module ────────────────────────────────────────────────
 * geometry.ts is the single source of truth and is imported by React. Node
 * cannot read TypeScript, and the file only uses two bits of TS syntax, so we
 * strip those and import the result rather than restating the numbers here.
 */
const geometrySource = await fs.readFile(path.join(root, 'lib', 'brand', 'geometry.ts'), 'utf8');
const geometryJs = geometrySource.replace(/ as const/g, '').replace(/: (?:string|number)\b/g, '');
const G = await import(
  `data:text/javascript;base64,${Buffer.from(geometryJs).toString('base64')}`
);

const {
  JEDRO_INK,
  JEDRO_VIOLET,
  JEDRO_CYAN,
  JEDRO_WORDMARK_PATH,
  LOCKUP_VIEW_BOX,
  LOCKUP_WIDTH,
  LOCKUP_HEIGHT,
  LOCKUP_MARK,
  CLEAR_SPACE_RATIO,
  MARK_SIZE,
  markPath,
  markGradientVector,
} = G;

/** Corner radius of the app-icon tile, as a share of its edge — iOS proportions. */
const TILE_RADIUS_RATIO = 0.2237;
/** Plus size inside a tile icon, as a share of the tile. */
const TILE_MARK_RATIO = 0.52;
/**
 * Optical sizing for the favicon. At 16px the 52% plus inside a 22% rounded
 * tile collapses into a smudge: the corners eat the square and the arms land
 * under two pixels. The small sizes therefore get a tighter corner and a
 * noticeably bigger plus. Nobody ever sees a 16px favicon and a 512px app
 * icon side by side, so the two tiers can differ.
 */
const FAVICON_RADIUS_RATIO = 0.14;
const FAVICON_MARK_RATIO = 0.68;
/** Plus size inside a maskable icon — small enough to survive an aggressive crop. */
const MASKABLE_MARK_RATIO = 0.42;

const svgOpen = (viewBox, w, h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}" fill="none">`;

const gradientDef = (id, size, x = 0, y = 0) => {
  const { x1, y1, x2, y2 } = markGradientVector(size, x, y);
  return (
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
    `x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
    `<stop offset="0" stop-color="${JEDRO_VIOLET}"/>` +
    `<stop offset="1" stop-color="${JEDRO_CYAN}"/>` +
    `</linearGradient>`
  );
};

/* ── the master vectors ───────────────────────────────────────────────────── */

/** Full horizontal lockup. `markFill` of null means "use the brand gradient". */
function lockupSvg({ letteringFill, markFill = null, title = 'Jedro+' }) {
  const id = 'jedroGradient';
  const usesGradient = markFill === null;
  return (
    svgOpen(LOCKUP_VIEW_BOX, LOCKUP_WIDTH, LOCKUP_HEIGHT) +
    `<title>${title}</title>` +
    (usesGradient
      ? `<defs>${gradientDef(id, LOCKUP_MARK.size, LOCKUP_MARK.x, LOCKUP_MARK.y)}</defs>`
      : '') +
    `<path d="${JEDRO_WORDMARK_PATH}" fill="${letteringFill}"/>` +
    `<path d="${markPath(LOCKUP_MARK.size, LOCKUP_MARK.x, LOCKUP_MARK.y)}" ` +
    `fill="${usesGradient ? `url(#${id})` : markFill}"/>` +
    `</svg>`
  );
}

/** The plus on its own, edge to edge on a square. */
function markSvg({ fill = null, title = 'Jedro+' } = {}) {
  const id = 'jedroGradient';
  const usesGradient = fill === null;
  return (
    svgOpen(`0 0 ${MARK_SIZE} ${MARK_SIZE}`, MARK_SIZE, MARK_SIZE) +
    `<title>${title}</title>` +
    (usesGradient ? `<defs>${gradientDef(id, MARK_SIZE)}</defs>` : '') +
    `<path d="${markPath()}" fill="${usesGradient ? `url(#${id})` : fill}"/>` +
    `</svg>`
  );
}

/**
 * App icon: a gradient tile with the plus knocked out in white.
 * `radiusRatio: 0` gives the full-bleed square iOS and Android masks expect.
 */
function iconSvg({ radiusRatio = TILE_RADIUS_RATIO, markRatio = TILE_MARK_RATIO } = {}) {
  const S = 512;
  const id = 'jedroGradient';
  const m = S * markRatio;
  const o = (S - m) / 2;
  const r = S * radiusRatio;
  // A tile is solid to its corners, so unlike the standalone mark its gradient
  // runs the full diagonal — that puts the two brand colours in the corners and
  // keeps the middle identical to the mark's.
  return (
    svgOpen(`0 0 ${S} ${S}`, S, S) +
    `<title>Jedro+</title>` +
    `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
    `x1="0" y1="0" x2="${S}" y2="${S}">` +
    `<stop offset="0" stop-color="${JEDRO_VIOLET}"/>` +
    `<stop offset="1" stop-color="${JEDRO_CYAN}"/></linearGradient></defs>` +
    `<rect width="${S}" height="${S}" rx="${r}" ry="${r}" fill="url(#${id})"/>` +
    `<path d="${markPath(m, o, o)}" fill="#FFFFFF"/>` +
    `</svg>`
  );
}

/**
 * Lockup on a solid plate, with the brand clear space baked in as padding.
 *
 * Email is the reason this exists: a transparent PNG with near-black lettering
 * disappears the moment a client paints a dark background behind it, and Gmail
 * and Outlook both do that in dark mode. Shipping the plate inside the image
 * keeps the signature readable everywhere.
 */
function plateLockupSvg({ letteringFill = JEDRO_INK, plate = '#FFFFFF', markFill = null } = {}) {
  const pad = LOCKUP_MARK.size * CLEAR_SPACE_RATIO;
  const w = LOCKUP_WIDTH + pad * 2;
  const h = LOCKUP_HEIGHT + pad * 2;
  const id = 'jedroGradient';
  const usesGradient = markFill === null;
  return (
    svgOpen(`0 0 ${w} ${h}`, w, h) +
    `<title>Jedro+</title>` +
    (usesGradient
      ? `<defs>${gradientDef(id, LOCKUP_MARK.size, LOCKUP_MARK.x + pad, LOCKUP_MARK.y + pad)}</defs>`
      : '') +
    `<rect width="${w}" height="${h}" fill="${plate}"/>` +
    `<g transform="translate(${pad} ${pad})">` +
    `<path d="${JEDRO_WORDMARK_PATH}" fill="${letteringFill}"/>` +
    `<path d="${markPath(LOCKUP_MARK.size, LOCKUP_MARK.x, LOCKUP_MARK.y)}" ` +
    `fill="${usesGradient ? `url(#${id})` : markFill}"/>` +
    `</g></svg>`
  );
}

/**
 * Profile picture for social accounts. Instagram and TikTok crop avatars to a
 * circle, so the artwork has to be square, full-bleed and safe to lose its
 * corners — which rules the wordmark out and leaves the mark. `plate` paints
 * the background; a null plate means the brand gradient with a white plus.
 */
function socialSvg({ plate = null, markRatio = 0.52 } = {}) {
  const S = 512;
  const m = S * markRatio;
  const o = (S - m) / 2;
  const onGradient = plate === null;
  const bg = onGradient
    ? `<linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${S}" y2="${S}">` +
      `<stop offset="0" stop-color="${JEDRO_VIOLET}"/><stop offset="1" stop-color="${JEDRO_CYAN}"/></linearGradient>`
    : '';
  const markFill = onGradient ? '#FFFFFF' : `url(#mk)`;
  const mk = onGradient ? '' : gradientDef('mk', m, o, o);
  return (
    svgOpen(`0 0 ${S} ${S}`, S, S) +
    `<title>Jedro+</title>` +
    `<defs>${bg}${mk}</defs>` +
    `<rect width="${S}" height="${S}" fill="${onGradient ? 'url(#bg)' : plate}"/>` +
    `<path d="${markPath(m, o, o)}" fill="${markFill}"/>` +
    `</svg>`
  );
}

const svgs = {
  'jedro-logo.svg': lockupSvg({ letteringFill: JEDRO_INK }),
  'jedro-logo-white.svg': lockupSvg({ letteringFill: '#FFFFFF' }),
  'jedro-logo-mono-black.svg': lockupSvg({ letteringFill: JEDRO_INK, markFill: JEDRO_INK }),
  'jedro-logo-mono-white.svg': lockupSvg({ letteringFill: '#FFFFFF', markFill: '#FFFFFF' }),
  'jedro-mark.svg': markSvg(),
  'jedro-mark-white.svg': markSvg({ fill: '#FFFFFF' }),
  'jedro-mark-black.svg': markSvg({ fill: JEDRO_INK }),
  'jedro-logo-plate-white.svg': plateLockupSvg(),
  'jedro-logo-plate-ink.svg': plateLockupSvg({ letteringFill: '#FFFFFF', plate: JEDRO_INK }),
  'jedro-icon.svg': iconSvg(),
  'jedro-icon-small.svg': iconSvg({
    radiusRatio: FAVICON_RADIUS_RATIO,
    markRatio: FAVICON_MARK_RATIO,
  }),
  'jedro-icon-square.svg': iconSvg({ radiusRatio: 0 }),
  'jedro-social-gradient.svg': socialSvg(),
  'jedro-social-white.svg': socialSvg({ plate: '#FFFFFF' }),
  'jedro-social-ink.svg': socialSvg({ plate: JEDRO_INK }),
  'jedro-icon-maskable.svg': iconSvg({ radiusRatio: 0, markRatio: MASKABLE_MARK_RATIO }),
};

/* ── raster exports ───────────────────────────────────────────────────────── */

const render = (svg, width, height) =>
  sharp(Buffer.from(svg), { density: 384 }).resize({ width, height, fit: 'fill' }).png({ compressionLevel: 9 });

/** Minimal PNG-in-ICO container — what every browser released this decade reads. */
async function writeIco(svg, sizes, dest) {
  const images = await Promise.all(sizes.map((s) => render(svg, s, s).toBuffer()));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + sizes.length * 16;
  const entries = sizes.map((size, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(images[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return e;
  });
  await fs.writeFile(dest, Buffer.concat([header, ...entries, ...images]));
}

/* ── run ──────────────────────────────────────────────────────────────────── */

await fs.mkdir(PNG, { recursive: true });

const written = [];
const write = async (p, buf) => {
  await fs.writeFile(p, buf);
  written.push(path.relative(root, p));
};

for (const [name, svg] of Object.entries(svgs)) {
  await write(path.join(BRAND, name), svg);
}

const lockupHeight = (w) => Math.round((w * LOCKUP_HEIGHT) / LOCKUP_WIDTH);

for (const w of [480, 960, 1920, 3840]) {
  await write(
    path.join(PNG, `jedro-logo-${w}.png`),
    await render(svgs['jedro-logo.svg'], w, lockupHeight(w)).toBuffer(),
  );
  await write(
    path.join(PNG, `jedro-logo-white-${w}.png`),
    await render(svgs['jedro-logo-white.svg'], w, lockupHeight(w)).toBuffer(),
  );
}

for (const w of [480, 960, 1920, 3840]) {
  await write(
    path.join(PNG, `jedro-logo-mono-black-${w}.png`),
    await render(svgs['jedro-logo-mono-black.svg'], w, lockupHeight(w)).toBuffer(),
  );
  await write(
    path.join(PNG, `jedro-logo-mono-white-${w}.png`),
    await render(svgs['jedro-logo-mono-white.svg'], w, lockupHeight(w)).toBuffer(),
  );
}

for (const s of [32, 64, 128, 256, 512, 1024]) {
  await write(path.join(PNG, `jedro-mark-${s}.png`), await render(svgs['jedro-mark.svg'], s, s).toBuffer());
  await write(
    path.join(PNG, `jedro-mark-white-${s}.png`),
    await render(svgs['jedro-mark-white.svg'], s, s).toBuffer(),
  );
}

for (const s of [64, 128, 192, 256, 512, 1024]) {
  await write(path.join(PNG, `jedro-icon-${s}.png`), await render(svgs['jedro-icon.svg'], s, s).toBuffer());
}

// Favicon + PWA + Apple. iOS and Android apply their own mask, so those get the
// full-bleed square; everything else gets the rounded tile.
await write(path.join(root, 'app', 'icon.png'), await render(svgs['jedro-icon.svg'], 512, 512).toBuffer());
await write(
  path.join(root, 'app', 'apple-icon.png'),
  await render(svgs['jedro-icon-square.svg'], 180, 180).toBuffer(),
);
await writeIco(svgs['jedro-icon-small.svg'], [16, 32, 48], path.join(root, 'app', 'favicon.ico'));
written.push('app/favicon.ico');

await write(path.join(root, 'public', 'icon.png'), await render(svgs['jedro-icon.svg'], 512, 512).toBuffer());
await write(
  path.join(root, 'public', 'android-icon-192.png'),
  await render(svgs['jedro-icon.svg'], 192, 192).toBuffer(),
);
await write(
  path.join(root, 'public', 'maskable-icon-512.png'),
  await render(svgs['jedro-icon-maskable.svg'], 512, 512).toBuffer(),
);

/* ── social profile pictures ───────────────────────────────────────────────
 * 1080 is what both Instagram and TikTok want uploaded; the smaller sizes are
 * for places that ask for an exact file, and 200 is TikTok's stated minimum.
 */
const SOCIAL = path.join(BRAND, 'social');
await fs.mkdir(SOCIAL, { recursive: true });

for (const [name, key] of [
  ['gradient', 'jedro-social-gradient.svg'],
  ['white', 'jedro-social-white.svg'],
  ['ink', 'jedro-social-ink.svg'],
]) {
  for (const s of [1080, 512, 320, 200]) {
    await write(
      path.join(SOCIAL, `jedro-social-${name}-${s}.png`),
      await render(svgs[key], s, s).toBuffer(),
    );
  }
}

/* ── e-mail signatures ─────────────────────────────────────────────────────
 * Mail clients do not render SVG, do not reliably scale images, and Outlook
 * ignores CSS sizing — so every file here is rendered at exactly twice its
 * intended display width and the snippet pins width/height in HTML attributes.
 * That is what makes a signature look sharp on a retina screen and correct in
 * Outlook at the same time.
 */
const EMAIL = path.join(BRAND, 'email');
await fs.mkdir(EMAIL, { recursive: true });

/** Display widths, in CSS px, that a signature realistically uses. */
const EMAIL_WIDTHS = [160, 200, 240];
const RETINA = 2;

const plateAspect =
  (LOCKUP_HEIGHT + LOCKUP_MARK.size * CLEAR_SPACE_RATIO * 2) /
  (LOCKUP_WIDTH + LOCKUP_MARK.size * CLEAR_SPACE_RATIO * 2);

for (const w of EMAIL_WIDTHS) {
  const px = w * RETINA;
  await write(
    path.join(EMAIL, `jedro-logo-email-${w}.png`),
    await render(svgs['jedro-logo.svg'], px, lockupHeight(px)).toBuffer(),
  );
  await write(
    path.join(EMAIL, `jedro-logo-email-white-${w}.png`),
    await render(svgs['jedro-logo-white.svg'], px, lockupHeight(px)).toBuffer(),
  );
  await write(
    path.join(EMAIL, `jedro-logo-email-safe-${w}.png`),
    await render(svgs['jedro-logo-plate-white.svg'], px, Math.round(px * plateAspect)).toBuffer(),
  );
}

for (const s of [32, 40, 48]) {
  await write(
    path.join(EMAIL, `jedro-mark-email-${s}.png`),
    await render(svgs['jedro-icon.svg'], s * RETINA, s * RETINA).toBuffer(),
  );
}

// Paste-ready snippet. Kept as a table with inline styles because that is the
// only layout Outlook and Gmail both honour.
const SIG_W = 200;
const sigH = lockupHeight(SIG_W);
const signatureHtml = `<!--
  Jedro+ e-mail signature
  ───────────────────────
  1. Replace BASE_URL with the public address of this app, e.g. https://jedroplus.si
     The image MUST be an absolute URL — mail clients cannot read local files.
  2. Replace the fields in CAPITALS.
  3. Paste into Gmail: Settings → See all settings → Signature.
     Paste into Outlook: File → Options → Mail → Signatures.
  4. Do not resize the image by dragging it. The width/height below are
     deliberate: the file is 2x that size so it stays sharp on retina screens.

  Using it on a dark signature background? Swap the file for
  jedro-logo-email-white-200.png. Worried about dark mode in Gmail/Outlook?
  Use jedro-logo-email-safe-200.png, which carries its own white plate.
-->
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:${JEDRO_INK};">
  <tr>
    <td style="padding:0 0 12px 0;">
      <a href="BASE_URL" style="text-decoration:none;border:0;">
        <img src="BASE_URL/brand/email/jedro-logo-email-${SIG_W}.png"
             width="${SIG_W}" height="${sigH}" alt="Jedro+"
             style="display:block;border:0;outline:none;text-decoration:none;width:${SIG_W}px;height:${sigH}px;" />
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 0 2px 0;font-size:15px;font-weight:bold;color:${JEDRO_INK};">IME PRIIMEK</td>
  </tr>
  <tr>
    <td style="padding:0 0 8px 0;font-size:13px;color:#6B7280;">VLOGA</td>
  </tr>
  <tr>
    <td style="padding:0 0 2px 0;font-size:13px;">
      <a href="tel:TELEFON" style="color:${JEDRO_INK};text-decoration:none;">TELEFON</a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 0 2px 0;font-size:13px;">
      <a href="mailto:EPOSTA" style="color:${JEDRO_INK};text-decoration:none;">EPOSTA</a>
    </td>
  </tr>
  <tr>
    <td style="padding:0;font-size:13px;">
      <a href="BASE_URL" style="color:${JEDRO_VIOLET};text-decoration:none;">SPLETNA STRAN</a>
    </td>
  </tr>
</table>
`;
await write(path.join(EMAIL, 'signature.html'), signatureHtml);

// Social preview: the lockup centred on white, sized so it survives the crop
// every network applies.
const OG_W = 1200;
const OG_H = 630;
const ogLogoW = 620;
const ogSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OG_W} ${OG_H}" width="${OG_W}" height="${OG_H}">` +
  `<rect width="${OG_W}" height="${OG_H}" fill="#FFFFFF"/>` +
  `<g transform="translate(${(OG_W - ogLogoW) / 2} ${(OG_H - (ogLogoW * LOCKUP_HEIGHT) / LOCKUP_WIDTH) / 2}) ` +
  `scale(${ogLogoW / LOCKUP_WIDTH})">` +
  `<defs>${gradientDef('ogGradient', LOCKUP_MARK.size, LOCKUP_MARK.x, LOCKUP_MARK.y)}</defs>` +
  `<path d="${JEDRO_WORDMARK_PATH}" fill="${JEDRO_INK}"/>` +
  `<path d="${markPath(LOCKUP_MARK.size, LOCKUP_MARK.x, LOCKUP_MARK.y)}" fill="url(#ogGradient)"/>` +
  `</g></svg>`;
await write(path.join(root, 'public', 'og-image.png'), await render(ogSvg, OG_W, OG_H).toBuffer());

void zlib;
console.log(`Wrote ${written.length} files:`);
for (const f of written) console.log('  ' + f);
