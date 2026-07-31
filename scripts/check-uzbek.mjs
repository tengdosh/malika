#!/usr/bin/env node
/**
 * Uzbek apostrophe lint.
 *
 * The single most common way this codebase breaks. In Uzbek (Latin):
 *   Oʻ / Gʻ            -> U+02BB  modifier letter turned comma
 *   tutuq belgisi ʼ    -> U+02BC  modifier letter apostrophe
 *   hero’dan, floater’lar (foreign stem + Uzbek suffix) -> U+2019
 *
 * A straight ' or a left quote ' (U+2018) after o/O/g/G is always wrong.
 * Editors, phone keyboards and copy-paste from Word all produce them silently,
 * and the result renders in a fallback face — visible in almost every sentence.
 *
 * Usage:
 *   node scripts/check-uzbek.mjs                 # lint the real source tree
 *   node scripts/check-uzbek.mjs <glob> [<glob>] # lint specific paths (fixtures)
 */
import { readFile } from 'node:fs/promises';
import { globSync } from 'glob';

const DEFAULT_PATTERNS = ['src/content/**/*.{md,mdx}', 'src/**/*.astro'];

/**
 * Straight apostrophe or left single quote after o/O/g/G — and followed by a
 * letter.
 *
 * The trailing letter is what makes this usable. The bare rule `[oOgG]['‘]`
 * matches every JavaScript string literal that happens to end in o or g:
 *
 *     import EntryRow from './EntryRow.astro';   // o'
 *     ogImage = '/og-default.png';               // g'
 *     html[data-textsize='lg'] { ... }           // g'
 *
 * Across this codebase that was 55 hits, none of them Uzbek — a lint that noisy
 * gets switched off within a week.
 *
 * In Uzbek, Oʻ / Gʻ are word-internal: the modifier letter is always followed by
 * another letter (boʻlsa, sogʻliq, oʻqish, Gʻafur). A quote that ends a token is
 * therefore code; a quote followed by a letter is a real error. This catches
 * every genuine violation and no code — see scripts/check-fixtures.mjs.
 */
const WRONG = /[oOgG]['‘](?=\p{L})/gu;

const patterns = process.argv.slice(2);
const files = globSync(patterns.length ? patterns : DEFAULT_PATTERNS, {
  ignore: ['**/node_modules/**', 'dist/**'],
}).sort();

let violations = 0;

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    for (const match of line.matchAll(WRONG)) {
      const col = (match.index ?? 0) + 1;
      const bad = match[0];
      const cp = bad.charCodeAt(1) === 0x2018 ? 'U+2018' : "straight '";
      const fix = `${bad[0]}ʻ`;
      console.error(
        `  ${file}:${i + 1}:${col}  ${cp} in "${bad}" — should be "${fix}" (U+02BB)`,
      );
      console.error(`      ${line.trim().slice(0, 100)}`);
      violations += 1;
    }
  });
}

if (violations > 0) {
  console.error(
    `\ncheck-uzbek: ${violations} wrong apostrophe(s) in ${files.length} file(s).` +
      '\n  Oʻ / Gʻ use U+02BB (ʻ). Tutuq belgisi uses U+02BC (ʼ).' +
      '\n  A foreign stem taking an Uzbek suffix uses U+2019 (’).',
  );
  process.exit(1);
}

console.log(`check-uzbek: ${files.length} files clean.`);
