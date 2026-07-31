#!/usr/bin/env node
/**
 * Fails the build if any shipped font file lacks U+02BB or U+02BC.
 *
 * Subsetting silently dropping these is a realistic failure mode: the Google
 * `latin-ext` subsets, for example, contain U+02BC but NOT U+02BB. If one of
 * those ever lands in public/fonts/, every Uzbek `Oʻ` and `Gʻ` on the site
 * would fall back to a different face — different shape, weight and spacing,
 * in almost every sentence.
 *
 * Caveat is exempt: it is used for the single word "Malika" in the signature
 * and never inherits Uzbek text.
 *
 * Pass a directory as argv[2] to check somewhere other than public/fonts
 * (used by scripts/check-fixtures.mjs).
 */
// fontkit 2.x is ESM with named exports only — no default export.
import { openSync } from 'fontkit';
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';

import { REQUIRED_CODEPOINTS } from './font-manifest.mjs';

const dir = process.argv[2] ?? 'public/fonts';
const files = globSync(`${dir}/**/*.{woff2,ttf}`).sort();

if (files.length === 0) {
  console.error(`check-glyphs: no font files found under ${dir}/ — run \`pnpm fonts\` first.`);
  process.exit(1);
}

const hex = (c) => 'U+' + c.toString(16).toUpperCase().padStart(4, '0');
let failed = false;
let checked = 0;

for (const file of files) {
  if (file.includes('caveat')) continue; // signature only, no Uzbek text
  const font = openSync(file);
  const missing = REQUIRED_CODEPOINTS.filter((cp) => !font.hasGlyphForCodePoint(cp));
  if (missing.length) {
    console.error(`  FAIL ${file} missing: ${missing.map(hex).join(', ')}`);
    failed = true;
  }
  checked += 1;
}

if (failed) {
  console.error('\ncheck-glyphs: a shipped face cannot render Uzbek Oʻ / Gʻ.');
  process.exit(1);
}

console.log(`check-glyphs: ${checked} faces carry ${REQUIRED_CODEPOINTS.map(hex).join(' + ')}.`);

/*
 * Coverage pass.
 *
 * The text faces are subset to an explicit charset rather than shipped whole, so
 * "U+02BB is present" is necessary but not sufficient: any character on the site
 * that the subset missed would silently render in a fallback face. This re-reads
 * every character of the built HTML and fails if the body or display face cannot
 * render it — which is the actual guarantee we want.
 */
const pages = globSync('dist/**/*.html');
if (pages.length === 0) {
  console.log('check-glyphs: no dist/ — skipping the rendered-text coverage pass.');
  process.exit(0);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const visibleText = (html) =>
  html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m);

const used = new Map(); // codepoint -> sample page
for (const page of pages) {
  for (const char of visibleText(readFileSync(page, 'utf8'))) {
    const cp = char.codePointAt(0);
    if (cp <= 0x20 || cp === 0x7f) continue; // whitespace and controls
    if (!used.has(cp)) used.set(cp, page);
  }
}

/** The two faces any Uzbek text on the site can land in. */
const TEXT_FACES = [
  'public/fonts/alegreya-sans/alegreya-sans-latin-400-normal.woff2',
  'public/fonts/alegreya/alegreya-latin-wght-normal.woff2',
];

const uncovered = [];
for (const facePath of TEXT_FACES) {
  const face = openSync(facePath);
  for (const [cp, page] of used) {
    if (!face.hasGlyphForCodePoint(cp)) {
      uncovered.push({ cp, face: facePath.split('/').pop(), page });
    }
  }
}

if (uncovered.length > 0) {
  console.error('\ncheck-glyphs: rendered text is not covered by the subset fonts —');
  console.error('  it would fall back to another face mid-sentence.\n');
  for (const item of uncovered.slice(0, 20)) {
    console.error(
      `  ${hex(item.cp)} "${String.fromCodePoint(item.cp)}"  missing from ${item.face}` +
        `  (first seen in ${item.page})`,
    );
  }
  console.error('\n  Fix: add the character to TEXT_CHARSET in scripts/font-manifest.mjs,');
  console.error('  then run `pnpm fonts`.');
  process.exit(1);
}

console.log(
  `check-glyphs: all ${used.size} distinct characters across ${pages.length} pages are covered.`,
);
