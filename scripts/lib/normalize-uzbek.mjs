/**
 * Uzbek apostrophe normaliser — the shared implementation.
 *
 * The split this module exists to enforce: **content is normalised, source code
 * is linted.** Malika writes on a phone. Her keyboard produces `o'qish`, and no
 * amount of documentation changes that. A CI failure she never sees is not
 * feedback — so her text is repaired automatically, while the same character in
 * a .astro UI string still fails scripts/check-uzbek.mjs, because that one was
 * typed by someone who can fix it.
 *
 * The three apostrophes of written Uzbek:
 *
 *   Oʻ / Gʻ           U+02BB  modifier letter turned comma   oʻqish, sogʻliq
 *   tutuq belgisi     U+02BC  modifier letter apostrophe     sanʼat, maʼno
 *   foreign stem + Uzbek suffix
 *                     U+2019  right single quotation mark    hero’dan
 *
 * The last one is why scripts/uzbek-exceptions.json exists. `hero’dan` ends its
 * stem in `o`, so the Oʻ rule would happily turn a borrowed English word into
 * `herʻodan`-shaped nonsense. Listed stems keep U+2019.
 *
 * Never rewrites: fenced code blocks, inline code spans, URLs, or a `url:` field
 * in frontmatter/YAML (that is where sources[].url lives, and a mangled link is
 * a broken citation on a health page).
 */
import { readFileSync } from 'node:fs';

/** ʻ — Oʻ / Gʻ. */
export const TURNED_COMMA = 'ʻ';
/** ʼ — tutuq belgisi. */
export const MODIFIER_APOSTROPHE = 'ʼ';
/** ’ — foreign stem taking an Uzbek suffix. */
export const RIGHT_QUOTE = '’';

const EXCEPTIONS_FILE = new URL('../uzbek-exceptions.json', import.meta.url);

/**
 * Every apostrophe-shaped character that can appear between two letters,
 * including the two correct ones — passing over already-correct text must be a
 * no-op, and a turned comma after the wrong letter is itself a defect worth
 * fixing (`sanʻat` -> `sanʼat`).
 */
const BETWEEN_LETTERS =
  /(\p{L})(['‘’ʼʻ])(?=\p{L})/gu;

/** Code spans, autolinks and bare URLs are copied through untouched. */
const PROTECTED = /(`[^`]*`|<[^>\s]+>|\bhttps?:\/\/\S+|\bwww\.\S+)/g;

/** A YAML key whose value is a link — `url:` and `- url:` alike. */
const URL_KEY = /^\s*(?:-\s*)?url\s*:/i;

/** ``` or ~~~ , opening or closing. */
const FENCE = /^\s*(?:```|~~~)/;

let cachedExceptions;

/**
 * Foreign stems that keep U+2019, lowercased.
 *
 * @param {URL|string} [file] override, for tests
 * @returns {Set<string>}
 */
export function loadExceptions(file = EXCEPTIONS_FILE) {
  if (file === EXCEPTIONS_FILE && cachedExceptions) return cachedExceptions;

  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  const stems = new Set((parsed.foreignStems ?? []).map((stem) => stem.toLowerCase()));

  if (file === EXCEPTIONS_FILE) cachedExceptions = stems;
  return stems;
}

/** Accepts a Set, an array, or nothing (load the file). */
const asSet = (exceptions) => {
  if (exceptions instanceof Set) return exceptions;
  if (Array.isArray(exceptions)) return new Set(exceptions.map((s) => s.toLowerCase()));
  return loadExceptions();
};

/**
 * Applies the three rules to a run of prose. No awareness of code, URLs or
 * frontmatter — callers that handle whole documents want normalizeUzbek().
 *
 * @param {string} text
 * @param {Set<string>|string[]} [exceptions]
 * @returns {string}
 */
export function normalizeSegment(text, exceptions) {
  const stems = asSet(exceptions);

  return text.replace(BETWEEN_LETTERS, (match, letter, apostrophe, offset, whole) => {
    // The whole word so far, so `hero` in `hero’dan` can be recognised.
    let start = offset;
    while (start > 0 && /\p{L}/u.test(whole[start - 1])) start -= 1;
    const stem = whole.slice(start, offset + 1).toLowerCase();

    if (stems.has(stem)) return letter + RIGHT_QUOTE;
    if (letter === 'o' || letter === 'O' || letter === 'g' || letter === 'G') {
      return letter + TURNED_COMMA;
    }
    // A right quote after any other letter is left alone: it is an English
    // possessive or a quoted phrase far more often than a tutuq belgisi
    // (`Kanski’s Clinical Ophthalmology`).
    if (apostrophe === RIGHT_QUOTE) return match;

    return letter + MODIFIER_APOSTROPHE;
  });
}

/**
 * Normalises a whole document, skipping everything that is not prose.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {Set<string>|string[]} [options.exceptions]
 * @param {boolean} [options.yaml] treat the entire file as data (a .yaml entry),
 *   rather than looking for a frontmatter block
 * @returns {string}
 */
export function normalizeUzbek(text, { exceptions, yaml = false } = {}) {
  const stems = asSet(exceptions);
  const lines = text.split('\n');

  let inFence = false;
  // Frontmatter only counts when the file opens with it.
  let inFrontmatter = !yaml && lines[0]?.trim() === '---';

  const normalised = lines.map((line, index) => {
    if (inFrontmatter) {
      if (index === 0) return line;
      if (/^(?:---|\.\.\.)\s*$/.test(line)) {
        inFrontmatter = false;
        return line;
      }
      return URL_KEY.test(line) ? line : protect(line, stems);
    }

    if (FENCE.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    if (yaml && URL_KEY.test(line)) return line;

    return protect(line, stems);
  });

  return normalised.join('\n');
}

/** Normalises the gaps between protected spans, leaving the spans verbatim. */
function protect(line, stems) {
  let out = '';
  let last = 0;

  for (const match of line.matchAll(PROTECTED)) {
    out += normalizeSegment(line.slice(last, match.index), stems);
    out += match[0];
    last = match.index + match[0].length;
  }

  return out + normalizeSegment(line.slice(last), stems);
}

/** True when the file would change — the cheap form for a --check run. */
export function needsNormalizing(text, options) {
  return normalizeUzbek(text, options) !== text;
}
