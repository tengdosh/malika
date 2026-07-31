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
export const TEXT_CHARSET = [
  // printable ASCII
  Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCodePoint(0x20 + i)).join(''),
  // Uzbek: Oʻ Gʻ (U+02BB) and tutuq belgisi (U+02BC)
  'ʻʼ',
  // No arrows: Alegreya's latin subset contains none, so asking for one yields a
  // fallback glyph. check-glyphs' coverage pass catches that in the built HTML.
  // typographic punctuation, incl. the · used in bylines and the — used in prose
  ' ©«»°·–—‘’“”•…‹›×',
  // accented Latin-1 for foreign names and book titles
  'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝß',
  'àáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ',
  // Turkish / Azerbaijani letters that appear in regional names
  'ıİşŞğĞ',
].join('');

/** Uzbek alphabet, digits and basic punctuation — enough for any heading emphasis. */
export const DISPLAY_ITALIC_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?()[]«»“”‘’"\'-–—…ʻʼ';

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
    // Display italic renders <em> inside headings only — today that is the single
    // word "Malika" in the hero. Prose <em> and blockquotes use the *body* italic,
    // a different file. So this face gets the Uzbek alphabet and basic punctuation
    // rather than the full text charset: it is on the LCP critical path and every
    // kilobyte here is measured in milliseconds.
    subsetText: DISPLAY_ITALIC_CHARSET,
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

/** Codepoints every shipped non-signature face must contain. */
export const REQUIRED_CODEPOINTS = [0x02bb, 0x02bc];
