/**
 * Checks that every character the built site renders can actually be drawn by
 * the shipped text faces — and decides, per character, whether that is a
 * build-blocking error or a warning.
 *
 * The split is the whole point:
 *
 *   Malika writes on a phone. Ellipses, em dashes, «», arrows and pasted
 *   characters are inevitable. If an unexpected character failed CI, she would
 *   save a post, never see the failure, and the site would silently stop
 *   updating — exactly the failure mode the apostrophe rules exist to prevent.
 *   So characters that come from her writing WARN and fall back to a system
 *   font, and the page still ships.
 *
 *   Characters in developer-authored UI strings are a different matter: someone
 *   is looking at CI, and the fix is a one-line edit. Those still FAIL.
 *
 * Attribution rule: if an uncovered character appears in any .astro or src/lib
 * source, it is UI-authored and fails. Otherwise it came from content — either
 * literally, or via a markdown transformation of content (smartypants turns
 * "x" into “x” and ... into …) — and warns.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openSync } from 'fontkit';
import { globSync } from 'glob';

import { resolveDistDir } from './browser.mjs';

/** The two faces any text on the site can land in. */
export const TEXT_FACES = [
  'public/fonts/alegreya-sans/alegreya-sans-latin-400-normal.woff2',
  'public/fonts/alegreya/alegreya-latin-wght-normal.woff2',
];

const UI_GLOBS = ['src/**/*.astro', 'src/lib/**/*.{ts,js}'];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export const visibleText = (html) =>
  html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m);

export const hex = (cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

/**
 * @param {{ distDir?: string, root?: string }} options
 * @returns {{ pages: number, distinct: number, warnings: object[], failures: object[] }}
 */
export function analyseGlyphCoverage({ distDir = resolveDistDir(), root = '.' } = {}) {
  const pages = globSync(`${distDir}/**/*.html`, { cwd: root });
  if (pages.length === 0) return { pages: 0, distinct: 0, warnings: [], failures: [] };

  // codepoint -> the first page it was seen on (repo-relative, for readable logs)
  const used = new Map();
  for (const page of pages) {
    for (const char of visibleText(readFileSync(join(root, page), 'utf8'))) {
      const cp = char.codePointAt(0);
      if (cp <= 0x20 || cp === 0x7f) continue; // whitespace and controls
      if (!used.has(cp)) used.set(cp, page);
    }
  }

  const faces = TEXT_FACES.map((path) => ({ name: path.split('/').pop(), font: openSync(join(root, path)) }));

  const uncovered = [];
  for (const [cp, page] of used) {
    const missingFrom = faces.filter(({ font }) => !font.hasGlyphForCodePoint(cp)).map((f) => f.name);
    if (missingFrom.length > 0) uncovered.push({ cp, page, missingFrom });
  }

  if (uncovered.length === 0) {
    return { pages: pages.length, distinct: used.size, warnings: [], failures: [] };
  }

  // Which uncovered characters appear in developer-authored source?
  const uiSource = globSync(UI_GLOBS, { cwd: root })
    .map((file) => readFileSync(join(root, file), 'utf8'))
    .join('\n');
  const uiChars = new Set([...uiSource].map((c) => c.codePointAt(0)));

  const warnings = [];
  const failures = [];
  for (const item of uncovered) {
    (uiChars.has(item.cp) ? failures : warnings).push(item);
  }

  return { pages: pages.length, distinct: used.size, warnings, failures };
}

/** Shared reporting so the build hook and the CI check say the same thing. */
export function reportGlyphCoverage(result, { log = console.log, warn = console.warn, error = console.error } = {}) {
  const { pages, distinct, warnings, failures } = result;

  if (pages === 0) {
    log('glyph coverage: no built HTML found — skipped.');
    return;
  }

  const describe = ({ cp, page }) => `${hex(cp)} "${String.fromCodePoint(cp)}"  first seen in ${page}`;

  if (warnings.length > 0) {
    warn(
      `\nglyph coverage: ${warnings.length} character(s) in content are not in the shipped fonts.` +
        '\n  These render in a system fallback font. The build is NOT blocked — nothing' +
        '\n  Malika writes should stop a deploy. Alegreya simply has no glyph for them.',
    );
    warnings.forEach((item) => warn(`    ${describe(item)}`));
  }

  if (failures.length > 0) {
    error(
      `\nglyph coverage: ${failures.length} character(s) in UI strings are not in the shipped fonts.` +
        '\n  These come from .astro / src/lib source, not from content, so they are a' +
        '\n  developer fix: use a character the font has, or add one it carries to' +
        '\n  TEXT_CHARSET in scripts/font-manifest.mjs and run `pnpm fonts`.',
    );
    failures.forEach((item) => error(`    ${describe(item)}`));
  }

  const covered = distinct - warnings.length - failures.length;
  log(
    `\nglyph coverage: ${covered}/${distinct} distinct characters across ${pages} pages covered` +
      ` — ${warnings.length} warning(s), ${failures.length} error(s).`,
  );
}
