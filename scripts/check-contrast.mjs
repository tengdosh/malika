#!/usr/bin/env node
/**
 * Colour rules, enforced against the stylesheet rather than against a list.
 *
 * The previous version kept PAIRINGS by hand and never read global.css, so a
 * pairing that nobody remembered to add was invisible. That is exactly how
 * `.prose li::marker { color: var(--blush) }` shipped at 2.18:1 in light mode:
 * the rule "--blush is never a text colour" was written in tokens.css, echoed in
 * this file's header, and enforced by nothing. It printed a `note:` and passed.
 *
 * What runs now:
 *
 *   1. FORBIDDEN FOREGROUND — `color: var(--blush)` anywhere is a failure, in
 *      any selector including pseudo-elements. `border-*-color` and
 *      `background` stay allowed; those are the legitimate uses.
 *   2. DERIVED PAIRINGS — where one rule sets both a colour and a background,
 *      that pairing is read straight out of the CSS and computed. No list.
 *   3. COVERAGE — where a rule sets only a colour, the background comes from an
 *      ancestor and cannot be derived statically. Those foregrounds must appear
 *      in PAIRINGS below, so an unlisted one fails loudly instead of silently.
 *   4. TOKENS ONLY — a raw hex outside tokens.css fails. This is what enforces
 *      "one accent only"; nothing else did.
 */
import { readFileSync } from 'node:fs';

const AA_TEXT = 4.5;
/** WCAG 1.4.11: a marker is a graphical object, so the bar is 3:1, not 4.5:1. */
const AA_NON_TEXT = 3.0;

/** Never a foreground. Backgrounds, borders and dividers only. */
const FORBIDDEN_FOREGROUND = new Set(['blush']);

/** Values that are not a resolvable colour token. */
const IGNORED_VALUES = new Set(['inherit', 'currentcolor', 'transparent', 'unset', 'initial']);

/**
 * Foregrounds whose background sits on an ancestor and so cannot be read out of
 * the same rule. Each is listed with the background it actually renders on.
 * Check 3 above fails if the stylesheet grows a foreground that is not here.
 */
const PAIRINGS = [
  ['ink', 'paper', 'body text'],
  ['muted', 'paper', 'secondary text, dates, standfirsts, list markers'],
  ['plum', 'paper', 'links, hero emphasis'],
  ['ink', 'surface', 'reading card title, source titles, admin tables'],
  ['muted', 'surface', 'reading author, source lines, footer credential'],
  ['plum', 'surface', 'footer links, reading + section labels'],
  ['ink', 'blush-soft', 'Hozir strip paragraph'],
  ['plum', 'blush-soft', 'chips, Hozir label, active text-size button'],
  ['paper', 'plum', 'primary button, skip link, chip hover'],
  ['paper', 'ink', 'button hover'],
];

// ------------------------------------------------------------------ colour

const srgb = (hex) =>
  [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

const luminance = (hex) => {
  const [r, g, b] = srgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const tokensCss = readFileSync('src/styles/tokens.css', 'utf8');

function readTheme(selector) {
  const block = tokensCss.slice(tokensCss.indexOf(selector));
  const body = block.slice(block.indexOf('{') + 1, block.indexOf('}'));
  const out = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
    out[name] = value;
  }
  return out;
}

const LIGHT = readTheme(':root{');
const DARK = { ...LIGHT, ...readTheme('html[data-theme="dark"]{') };

// -------------------------------------------------------------- css parsing

const css = readFileSync('src/styles/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Innermost rules only: a body containing `{` is a wrapper such as @media, and
 * its children are matched on their own. Keeps the parser to one regex without
 * mis-reading nested at-rules as declarations.
 */
function rules(source) {
  const found = [];
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    if (!selector || selector.startsWith('@')) continue;
    found.push({ selector, body: match[2] });
  }
  return found;
}

/** property -> value, with the property compared exactly so border-*-color is not a colour. */
function declarations(body) {
  const out = [];
  for (const raw of body.split(';')) {
    const at = raw.indexOf(':');
    if (at === -1) continue;
    out.push({ property: raw.slice(0, at).trim(), value: raw.slice(at + 1).trim() });
  }
  return out;
}

const tokenOf = (value) => value.match(/^var\(\s*--([\w-]+)\s*\)$/)?.[1];

// ------------------------------------------------------------------- checks

let failures = 0;
const fail = (message, detail) => {
  console.error(`  FAIL ${message}`);
  if (detail) console.error(`       ${detail}`);
  failures += 1;
};

const parsed = rules(css);
const derived = [];
const coverageNeeded = new Map(); // token -> [selectors]

for (const rule of parsed) {
  const decls = declarations(rule.body);
  const colour = decls.find((d) => d.property === 'color');
  const background = decls.find((d) => d.property === 'background' || d.property === 'background-color');

  // 4 — raw hex anywhere outside tokens.css
  for (const decl of decls) {
    if (/#[0-9A-Fa-f]{3,8}\b/.test(decl.value)) {
      fail(
        `raw colour in global.css: ${rule.selector}`,
        `${decl.property}: ${decl.value} — every colour goes through a token in tokens.css`,
      );
    }
  }

  if (!colour) continue;
  const fg = tokenOf(colour.value);
  if (!fg) {
    if (!IGNORED_VALUES.has(colour.value.toLowerCase())) {
      fail(`unrecognised colour value: ${rule.selector}`, `color: ${colour.value}`);
    }
    continue;
  }

  // 1 — forbidden foreground
  if (FORBIDDEN_FOREGROUND.has(fg)) {
    fail(
      `--${fg} used as a foreground: ${rule.selector}`,
      `--${fg} is ${ratio(LIGHT[fg], LIGHT.paper).toFixed(2)}:1 on --paper in light mode. ` +
        'Backgrounds, borders and dividers only.',
    );
    continue;
  }

  const bg = background ? tokenOf(background.value) : undefined;
  if (bg && LIGHT[bg]) {
    derived.push({ selector: rule.selector, fg, bg });
  } else {
    if (!coverageNeeded.has(fg)) coverageNeeded.set(fg, []);
    coverageNeeded.get(fg).push(rule.selector);
  }
}

// 3 — every foreground whose background is inherited must be accounted for
const listedForegrounds = new Set(PAIRINGS.map(([fg]) => fg));
for (const [fg, selectors] of coverageNeeded) {
  if (!listedForegrounds.has(fg)) {
    fail(
      `--${fg} is used as a foreground but is not in PAIRINGS`,
      `${selectors.slice(0, 3).join(', ')}${selectors.length > 3 ? ` (+${selectors.length - 3})` : ''}` +
        ' — add it with the background it renders on, so its contrast is computed.',
    );
  }
}

// 2 + the curated list — compute everything and report the table
const isNonText = (selector) => /::marker|::-moz-list|::before|::after/.test(selector);

const rows = [
  ...PAIRINGS.map(([fg, bg, usage]) => ({ fg, bg, usage, min: AA_TEXT })),
  ...derived.map((d) => ({
    fg: d.fg,
    bg: d.bg,
    usage: `css: ${d.selector}`,
    min: isNonText(d.selector) ? AA_NON_TEXT : AA_TEXT,
  })),
];

// Deduplicate identical fg/bg/threshold combinations for a readable table.
const seen = new Set();
const table = rows.filter((row) => {
  const key = `${row.fg}|${row.bg}|${row.min}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const width = Math.max(...table.map((r) => `${r.fg} / ${r.bg}`.length));
console.log(`  ${'pair'.padEnd(width)}  light    dark   min`);

for (const row of table) {
  const light = ratio(LIGHT[row.fg], LIGHT[row.bg]);
  const dark = ratio(DARK[row.fg], DARK[row.bg]);
  const ok = light >= row.min && dark >= row.min;
  if (!ok) failures += 1;
  console.log(
    `  ${`${row.fg} / ${row.bg}`.padEnd(width)}  ${light.toFixed(2).padStart(5)}:1  ` +
      `${dark.toFixed(2).padStart(5)}:1  ${row.min.toFixed(1)}${ok ? '  ' : '  FAIL'}  ${row.usage}`,
  );
}

console.log(
  `\n  read from global.css: ${parsed.length} rules, ` +
    `${derived.length} same-rule pairings, ${coverageNeeded.size} inherited foregrounds`,
);

if (failures > 0) {
  console.error(`\ncheck-contrast: ${failures} problem(s).`);
  process.exit(1);
}
console.log('check-contrast: every pairing in the stylesheet clears its threshold.');
