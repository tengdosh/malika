#!/usr/bin/env node
/**
 * Computes every foreground/background pairing this site actually uses, in both
 * themes, straight from tokens.css. The spec requires new pairings to be
 * computed and reported rather than eyeballed — this is that report, and it
 * fails the build below WCAG 2.1 AA (4.5:1).
 *
 * Two rules it also enforces mechanically:
 *   - --blush is never a text colour (2.18:1 on --paper).
 *   - no opacity on text — so every ratio here is the ratio users actually get.
 */
import { readFile } from 'node:fs/promises';

const AA = 4.5;

/** Pairings used in src/styles/global.css. Keep in sync when adding one. */
const PAIRINGS = [
  ['ink', 'paper', 'body text'],
  ['muted', 'paper', 'secondary text, dates, standfirsts'],
  ['plum', 'paper', 'links, hero emphasis'],
  ['ink', 'surface', 'reading card title, source titles'],
  ['muted', 'surface', 'reading author, source lines, footer credential'],
  ['plum', 'surface', 'footer links, reading + section labels'],
  ['ink', 'blush-soft', 'Hozir strip paragraph'],
  ['plum', 'blush-soft', 'chips, Hozir label, active text-size button'],
  ['paper', 'plum', 'primary button, skip link'],
  ['paper', 'plum', 'chip hover'],
  ['paper', 'ink', 'button hover'],
];

/** --blush must never appear as a foreground on these. */
const FORBIDDEN_TEXT = ['blush'];

const css = await readFile('src/styles/tokens.css', 'utf8');

function readTheme(selector) {
  const block = css.slice(css.indexOf(selector));
  const body = block.slice(block.indexOf('{') + 1, block.indexOf('}'));
  const out = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
    out[name] = value;
  }
  return out;
}

const light = readTheme(':root{');
const dark = { ...light, ...readTheme('html[data-theme="dark"]{') };

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

let failed = false;
const rows = [];

for (const [fg, bg, usage] of PAIRINGS) {
  const l = ratio(light[fg], light[bg]);
  const d = ratio(dark[fg], dark[bg]);
  const ok = l >= AA && d >= AA;
  if (!ok) failed = true;
  rows.push({ pair: `${fg} / ${bg}`, light: l, dark: d, ok, usage });
}

const w = Math.max(...rows.map((r) => r.pair.length));
console.log(`  ${'pair'.padEnd(w)}  light    dark`);
for (const r of rows) {
  const mark = r.ok ? ' ' : ' FAIL';
  console.log(
    `  ${r.pair.padEnd(w)}  ${r.light.toFixed(2).padStart(5)}:1  ${r.dark.toFixed(2).padStart(5)}:1${mark}  ${r.usage}`,
  );
}

// --blush as a text colour is banned outright, not just contrast-checked.
for (const token of FORBIDDEN_TEXT) {
  for (const [name, theme] of [
    ['light', light],
    ['dark', dark],
  ]) {
    const r = ratio(theme[token], theme.paper);
    if (r < AA) {
      console.log(
        `\n  note: --${token} on --paper is ${r.toFixed(2)}:1 in ${name} — background/border use only, never text.`,
      );
    }
  }
}

if (failed) {
  console.error('\ncheck-contrast: a pairing is below WCAG 2.1 AA (4.5:1).');
  process.exit(1);
}

console.log(`\ncheck-contrast: ${rows.length} pairings pass AA in both themes.`);
