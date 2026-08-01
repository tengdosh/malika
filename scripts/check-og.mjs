#!/usr/bin/env node
/**
 * Open Graph card checks.
 *
 * The share preview is the first impression when Malika drops a link in
 * Telegram, and it is rendered by a completely different text stack from the
 * site — satori, not a browser. So the font findings that shaped the site have
 * to be re-proved here: a card can lose every Oʻ and Gʻ and still "render",
 * because satori silently drops a glyph it cannot find.
 *
 * Asserts:
 *   1. the render fonts cover the Uzbek fixture, and the check FAILS on a face
 *      that genuinely lacks U+02BB (Caveat, a real font, is the negative case)
 *   2. a 90-character Uzbek title wraps rather than clipping
 *   3. a rendering failure falls back instead of breaking the build
 *   4. every built post has an OG card, and the page points at it
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'glob';

import { OG_FONTS, OG_GLYPH_FIXTURE } from './font-manifest.mjs';
import {
  loadOgFonts,
  measureTextRun,
  missingGlyphs,
  titleSize,
  renderOgCard,
  OG_FONT_DIR,
  OG_WIDTH,
  OG_HEIGHT,
} from './lib/og-card.mjs';
import { resolveDistDir } from './lib/browser.mjs';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${name}${detail ? `  (${detail})` : ''}`);
  } else {
    console.error(`  FAIL ${name}${detail ? `  (${detail})` : ''}`);
    failures += 1;
  }
};

if (!existsSync(join(OG_FONT_DIR, 'alegreya.ttf'))) {
  console.error(`check-og: no render fonts in ${OG_FONT_DIR} — run \`pnpm fonts\`.`);
  process.exit(1);
}

// ---------------------------------------------------------------- 1. glyphs
for (const font of OG_FONTS.filter((f) => !f.fixtureOnly)) {
  const missing = await missingGlyphs(join(OG_FONT_DIR, font.to), OG_GLYPH_FIXTURE);
  check(
    `${font.to} can draw "${OG_GLYPH_FIXTURE}"`,
    missing.length === 0,
    missing.length ? `missing ${missing.map((m) => m.hex).join(', ')}` : `${font.family}`,
  );
}

// The negative case, using a real font that genuinely lacks U+02BB.
const caveat = OG_FONTS.find((f) => f.fixtureOnly);
const caveatMissing = await missingGlyphs(join(OG_FONT_DIR, caveat.to), OG_GLYPH_FIXTURE);
check(
  'the glyph assertion FAILS on a font without U+02BB',
  caveatMissing.some((m) => m.cp === 0x02bb),
  `caveat.ttf missing ${caveatMissing.length} of the fixture's glyphs`,
);

// ------------------------------------------------------------- 2. long title
const fonts = await loadOgFonts();

const LONG_TITLE =
  'Koʻz oldidagi chivinlar nima va qachon shifokorga borish kerakligi haqida uzun sarlavha';
check('the long-title fixture is at least 85 characters', LONG_TITLE.length >= 85, `${LONG_TITLE.length} chars`);

const long = await renderOgCard({ title: LONG_TITLE, kicker: 'Koʻz sogʻligʻi', fonts });

const INK = '#2B2129';
const longRun = measureTextRun(long.svg, INK, { fontSize: titleSize(LONG_TITLE) });
check('the long title was actually rendered', Boolean(longRun), `${longRun?.glyphs ?? 0} glyphs`);

check(
  'a 90-character Uzbek title wraps onto multiple lines',
  (longRun?.lines ?? 0) > 1,
  `${longRun?.lines} lines, span ${Math.round(longRun?.span ?? 0)}px`,
);
check(
  'no glyph is drawn past the right edge',
  (longRun?.maxX ?? 0) < OG_WIDTH,
  `rightmost glyph starts at ${Math.round(longRun?.maxX ?? 0)} < ${OG_WIDTH}`,
);
check(
  'no glyph is drawn past the bottom edge',
  (longRun?.maxY ?? 0) < OG_HEIGHT,
  `lowest baseline ${Math.round(longRun?.maxY ?? 0)} < ${OG_HEIGHT}`,
);

// A short title must NOT wrap — otherwise "wraps" would pass for the wrong reason.
const SHORT_TITLE = 'Yozgi kitoblar';
const short = await renderOgCard({ title: SHORT_TITLE, kicker: 'Kitoblar', fonts });
const shortRun = measureTextRun(short.svg, INK, { fontSize: titleSize(SHORT_TITLE) });
check(
  'a short title stays on one line (control)',
  shortRun?.lines === 1,
  `${shortRun?.lines} line`,
);

// PNG header check: the card really is 1200x630.
const header = long.png.subarray(16, 24);
check(
  'the card is 1200x630',
  header.readUInt32BE(0) === OG_WIDTH && header.readUInt32BE(4) === OG_HEIGHT,
  `${header.readUInt32BE(0)}x${header.readUInt32BE(4)}`,
);

// ---------------------------------------------------------------- 3. fallback
let threw = false;
try {
  // No usable fonts is the most likely real failure — a forgotten `pnpm fonts`.
  await renderOgCard({ title: 'x', fonts: [] });
} catch {
  threw = true;
}
check('the renderer throws when it cannot render, so the caller can fall back', threw);

const endpoint = readFileSync('src/pages/og/[slug].png.ts', 'utf8');
check(
  'the endpoint catches that and serves og-default.png',
  /catch\s*\(/.test(endpoint) && endpoint.includes('og-default.png'),
);

// ------------------------------------------------------------- 4. built output
const dist = resolveDistDir();
const cards = globSync(`${dist}/og/*.png`);
const postPages = globSync(`${dist}/{yozuvlar,qaydlar}/*/index.html`);

if (postPages.length === 0) {
  console.log('  note: no built post pages — skipping the output checks (run `pnpm build`).');
} else {
  check(
    'every post has an OG card',
    cards.length >= postPages.length,
    `${cards.length} cards for ${postPages.length} posts`,
  );

  const fallbackBytes = readFileSync('public/og-default.png');
  const generated = cards.filter((file) => !readFileSync(file).equals(fallbackBytes));
  check(
    'the cards are generated, not silently the fallback',
    generated.length === cards.length,
    `${generated.length}/${cards.length} unique`,
  );

  const withoutCover = `${dist}/yozuvlar/yozgi-kitoblar/index.html`;
  if (existsSync(withoutCover)) {
    const html = readFileSync(withoutCover, 'utf8');
    check(
      'a post without a cover points og:image at its generated card',
      /og:image"\s+content="[^"]*\/og\/yozgi-kitoblar\.png"/.test(html),
    );
    check(
      'og:image:width / height are declared',
      html.includes('og:image:width') && html.includes('og:image:height'),
    );
  }

  const withCover = `${dist}/yozuvlar/navbatchilikdan-keyin/index.html`;
  if (existsSync(withCover)) {
    const html = readFileSync(withCover, 'utf8');
    check(
      'a post WITH a cover prefers the cover over the generated card',
      /og:image"\s+content="[^"]*_astro\//.test(html),
    );
  }
}

if (failures > 0) {
  console.error(`\ncheck-og: ${failures} problem(s).`);
  process.exit(1);
}
console.log('\ncheck-og: share previews are sound.');
