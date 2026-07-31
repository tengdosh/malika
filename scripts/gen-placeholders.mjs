#!/usr/bin/env node
/**
 * Generates the placeholder imagery, at the exact dimensions the real photos
 * must have. Run once; the output is committed. Re-run only if a ratio changes.
 *
 * These are deliberately marked with a diagonal rule so nobody mistakes one for
 * a finished asset. See src/assets/PLACEHOLDERS.md for the swap-in list.
 *
 * Run: node scripts/gen-placeholders.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PAPER = '#FDFAFB';
const SURFACE = '#F7EFF2';
const BLUSH_SOFT = '#F6E4EA';
const BLUSH = '#D99BB0';
const PLUM = '#7A3F63';

const svg = (w, h, body) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
           <stop offset="0%" stop-color="${SURFACE}"/>
           <stop offset="100%" stop-color="${BLUSH_SOFT}"/>
         </linearGradient>
         <pattern id="hatch" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
           <line x1="0" y1="0" x2="0" y2="18" stroke="${BLUSH}" stroke-width="1" opacity="0.35"/>
         </pattern>
       </defs>
       <rect width="${w}" height="${h}" fill="url(#g)"/>
       <rect width="${w}" height="${h}" fill="url(#hatch)"/>
       ${body}
     </svg>`,
  );

/** A soft arch mark, centred — echoes the site's one shape. */
const archMark = (w, h) => {
  const size = Math.min(w, h) * 0.34;
  const x = (w - size) / 2;
  const y = (h - size * 1.15) / 2;
  const r = size / 2;
  return `<path d="M${x} ${y + size * 1.15} L${x} ${y + r} A${r} ${r} 0 0 1 ${x + size} ${y + r} L${x + size} ${y + size * 1.15} Z"
            fill="none" stroke="${PLUM}" stroke-width="${Math.max(2, size * 0.035)}" opacity="0.45"/>`;
};

const TARGETS = [
  // portrait 3/4
  { file: 'src/assets/portrait-placeholder.jpg', w: 900, h: 1200 },
  // covers 4/3 (also cropped to 1/1 and 16/9 by CSS object-fit)
  { file: 'src/assets/covers/navbatchilikdan-keyin.jpg', w: 1600, h: 1200 },
  { file: 'src/assets/covers/koz-oldidagi-chivinlar.jpg', w: 1600, h: 1200 },
  { file: 'src/assets/covers/koz-anatomiyasi.jpg', w: 1600, h: 1200 },
  // book cover 2/3
  { file: 'src/assets/books/hozir-oqiyapman.jpg', w: 800, h: 1200 },
];

for (const t of TARGETS) {
  const out = join(root, t.file);
  await mkdir(dirname(out), { recursive: true });
  // JPEG, because the real photos will be JPEG: <Picture> derives its fallback
  // format from the source, and a PNG fallback of a 1440w cover is ~430 KB.
  await sharp(svg(t.w, t.h, archMark(t.w, t.h))).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  console.log(`  ${t.file}  ${t.w}x${t.h}`);
}

// Default Open Graph card: the wordmark dot on paper, no text (no font dependency).
const og = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
     <rect width="1200" height="630" fill="${PAPER}"/>
     <rect x="0" y="0" width="1200" height="10" fill="${BLUSH}"/>
     <circle cx="600" cy="290" r="46" fill="${BLUSH}"/>
     <circle cx="600" cy="290" r="70" fill="none" stroke="${BLUSH_SOFT}" stroke-width="22"/>
     <rect x="470" y="400" width="260" height="6" rx="3" fill="${PLUM}" opacity="0.55"/>
   </svg>`,
);
// Stays PNG: flat vector shapes, and it is served straight from public/.
await sharp(og).png({ compressionLevel: 9 }).toFile(join(root, 'public', 'og-default.png'));
console.log('  public/og-default.png  1200x630');
