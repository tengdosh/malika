/**
 * The exact font files this site ships, and where they come from.
 *
 * Only the `latin` subset is shipped. That is deliberate and load-bearing:
 * Google's `latin` unicode-range explicitly contains U+02BB-02BC, so every
 * Uzbek `Oʻ` / `Gʻ` / `ʼ` is covered by the same file as the surrounding text
 * and never falls back to another face. The `latin-ext` subsets do NOT contain
 * U+02BB — shipping them would put files in public/fonts/ that legitimately
 * fail the per-file glyph check.
 *
 * If latin-ext is ever needed (a book title with `š`, `ł`, `č`), add those files
 * here AND relax check-glyphs.mjs to a per-family union check — see README.
 */
/** The only text ever rendered in the signature face. Keep in sync with Signature.astro. */
export const SIGNATURE_TEXT = 'Malika';

/**
 * Charset every text face is subset to.
 *
 * Google's `latin` subset carries ~300 glyphs — accented Latin-1 for French,
 * German and Spanish, currency symbols, arrows, maths signs — almost none of
 * which Uzbek uses. At 5 faces that was 164 KB of fonts on a connection where
 * Lighthouse measured LCP at 2.2s against a 755ms floor.
 *
 * This keeps: ASCII, the Uzbek modifier letters, typographic punctuation, and
 * the accented Latin-1 + Turkish letters that turn up in foreign names and book
 * titles. Anything dropped would fall back to a different face mid-sentence,
 * which is exactly the failure this project is built to avoid — so
 * check-glyphs.mjs re-reads every character of the built HTML and fails if any
 * of it is not covered here.
 */
const range = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)).join('');

export const TEXT_CHARSET = [
  // printable ASCII — includes both straight quote forms
  range(0x20, 0x7e),
  // Latin-1 Supplement in full: accented letters for foreign names, plus « » ° ·
  // © ® ± ÷ § ¶ ½ ¼ ¾ — all of it is in the source face, and guessing which
  // subset of "ordinary writing" to allow is how characters go missing.
  range(0xa0, 0xff),
  // Uzbek: Oʻ Gʻ (U+02BB) and tutuq belgisi (U+02BC), plus common modifiers
  'ʻʼˆ˚˜',
  // Turkish / Azerbaijani letters that appear in regional names
  'ıİşŞğĞŒœ',
  // General punctuation: every dash form, every quote form, ellipsis, bullets,
  // daggers, primes, per-mille, fraction slash.
  range(0x2010, 0x201f),
  range(0x2020, 0x2022),
  '‥…‰′″‹›⁄',
  // Symbols the source face actually carries.
  '€™↑↓−∕',
].join('');

/**
 * Characters that are wanted but simply do not exist in Alegreya's latin subset:
 * → ← ↔ ≈ ≤ ≥ ≠ ∞ √ № ₽ ₸, and every emoji. Subsetting cannot add a glyph the
 * source font does not have, so these are listed here as documentation rather
 * than in the charset. They fall back to a system font, and the coverage pass
 * reports them as warnings when they come from content.
 */
export const UNAVAILABLE_IN_SOURCE = '→←↔≈≤≥≠∞√№₽₸';

export const FONT_FILES = [
  // Display — Alegreya, variable weight axis.
  {
    from: '@fontsource-variable/alegreya/files/alegreya-latin-wght-normal.woff2',
    to: 'alegreya/alegreya-latin-wght-normal.woff2',
    family: 'Alegreya',
    style: 'normal',
    weight: '400 900',
    subsetText: TEXT_CHARSET,
    // Preloaded because the LCP element on every page is a display-face heading.
    // With font-display:swap and no preload, LCP is pinned to this file's arrival
    // (measured: 2185ms -> see README "Performance").
    preload: true,
  },
  {
    from: '@fontsource-variable/alegreya/files/alegreya-latin-wght-italic.woff2',
    to: 'alegreya/alegreya-latin-wght-italic.woff2',
    family: 'Alegreya',
    style: 'italic',
    weight: '400 900',
    // Same charset as the rest: markdown can put <em> inside a heading, which
    // lands in this face, and a narrower charset here would be a second and much
    // subtler coverage gap.
    subsetText: TEXT_CHARSET,
    // The hero h1 — the LCP element on the homepage — contains <em>Malika</em>.
    // Without this preload the heading re-renders when the italic face lands and
    // LCP is pinned to that moment (measured: 2183ms -> 1961ms).
    preload: true,
  },

  // Body + UI — Alegreya Sans. Upstream has no variable version, so these are static cuts.
  {
    from: '@fontsource/alegreya-sans/files/alegreya-sans-latin-400-normal.woff2',
    to: 'alegreya-sans/alegreya-sans-latin-400-normal.woff2',
    family: 'Alegreya Sans',
    style: 'normal',
    weight: '400',
    subsetText: TEXT_CHARSET,
    preload: true, // the body face, and the only preloaded file
  },
  {
    from: '@fontsource/alegreya-sans/files/alegreya-sans-latin-400-italic.woff2',
    to: 'alegreya-sans/alegreya-sans-latin-400-italic.woff2',
    family: 'Alegreya Sans',
    style: 'italic',
    weight: '400',
    subsetText: TEXT_CHARSET,
  },
  {
    from: '@fontsource/alegreya-sans/files/alegreya-sans-latin-500-normal.woff2',
    to: 'alegreya-sans/alegreya-sans-latin-500-normal.woff2',
    family: 'Alegreya Sans',
    style: 'normal',
    weight: '500',
    subsetText: TEXT_CHARSET,
  },
  {
    from: '@fontsource/alegreya-sans/files/alegreya-sans-latin-700-normal.woff2',
    to: 'alegreya-sans/alegreya-sans-latin-700-normal.woff2',
    family: 'Alegreya Sans',
    style: 'normal',
    weight: '700',
    subsetText: TEXT_CHARSET,
  },

  // Signature only. Caveat has no U+02BB — Uzbek text must never inherit it.
  // Subset to the five glyphs of "Malika": 75 KB for one word is not a trade we
  // make on a mobile-first Uzbek connection. Temporary anyway — see SIGNATURE TODO.
  {
    from: '@fontsource-variable/caveat/files/caveat-latin-wght-normal.woff2',
    to: 'caveat/caveat-malika-subset.woff2',
    family: 'Caveat',
    style: 'normal',
    weight: '400 700',
    subsetText: SIGNATURE_TEXT,
  },
];

/** Google Fonts `latin` subset range. Contains U+02BB-02BC — the reason this works. */
export const LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

/**
 * Faces the OG-image renderer needs as TTF.
 *
 * satori cannot read woff2 — only TTF, OTF and WOFF — so `pnpm fonts` also
 * decompresses these into .og-fonts/ (build-only, never served). They are the
 * same subset files the site ships, so an OG card can never contain a glyph the
 * page itself cannot render.
 */
export const OG_FONTS = [
  {
    from: 'alegreya/alegreya-latin-wght-normal.woff2',
    to: 'alegreya.ttf',
    family: 'Alegreya',
    // Alegreya is a VARIABLE font and satori's opentype fork cannot parse one —
    // it throws "Cannot read properties of undefined". Pinning the wght axis
    // produces a static instance it accepts. 600 matches the site's headings.
    pinWeight: 600,
  },
  {
    from: 'alegreya-sans/alegreya-sans-latin-500-normal.woff2',
    to: 'alegreya-sans.ttf',
    family: 'Alegreya Sans',
    // Already static — Alegreya Sans has no variable version upstream.
  },
  // Not used for rendering. Kept so scripts/check-og.mjs can prove the glyph
  // assertion fails on a face that genuinely lacks U+02BB.
  {
    from: 'caveat/caveat-malika-subset.woff2',
    to: 'caveat.ttf',
    family: 'Caveat',
    pinWeight: 400,
    fixtureOnly: true,
  },
];

/** Uzbek fixture string every OG font must be able to draw. */
export const OG_GLYPH_FIXTURE = 'oʻqish, gʻamxoʻrlik, sanʼat';

/** Codepoints every shipped non-signature face must contain. */
export const REQUIRED_CODEPOINTS = [0x02bb, 0x02bc];
