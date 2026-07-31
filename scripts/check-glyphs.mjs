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
import { globSync } from 'glob';

import { REQUIRED_CODEPOINTS } from './font-manifest.mjs';
import { analyseGlyphCoverage, reportGlyphCoverage } from './lib/glyph-coverage.mjs';

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
 * Coverage pass — see scripts/lib/glyph-coverage.mjs for the warn/fail split.
 * Characters from Malika's writing warn and fall back; characters from
 * developer-authored UI strings fail.
 */
const coverage = analyseGlyphCoverage();
reportGlyphCoverage(coverage);

if (coverage.failures.length > 0) process.exit(1);
