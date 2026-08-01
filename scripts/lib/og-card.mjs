/**
 * Open Graph card renderer.
 *
 * When Malika drops a link in Telegram, the preview card is the whole first
 * impression — so this is the highest-value piece of the SEO work, and it is
 * about sharing, not ranking.
 *
 * satori (JSX -> SVG) + resvg (SVG -> PNG), both at build time. No runtime
 * service, nothing for a visitor to wait on.
 *
 * Design uses the existing tokens only: --paper ground, --blush rule, --plum
 * accent, Alegreya for the title. It is the site's visual language at 1200x630,
 * not a new one.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OG_FONTS, OG_GLYPH_FIXTURE } from '../font-manifest.mjs';

/**
 * Where the render fonts live.
 *
 * NOT derived from import.meta.url: Vite bundles this module into the SSR build,
 * so at build time that resolves to dist/.og-fonts and every card silently falls
 * back to the default image. cwd is the project root for every entry point that
 * renders a card (astro build, and the check scripts).
 */
const CANDIDATE_DIRS = [
  process.env.OG_FONT_DIR,
  join(process.cwd(), '.og-fonts'),
  join(resolve(dirname(fileURLToPath(import.meta.url)), '../..'), '.og-fonts'),
].filter(Boolean);

export const OG_FONT_DIR =
  CANDIDATE_DIRS.find((dir) => existsSync(join(dir, 'alegreya.ttf'))) ?? CANDIDATE_DIRS[1];

export const OG_WIDTH = 1200;
export const OG_LINE_HEIGHT_RATIO = 1.16;
export const OG_HEIGHT = 630;

/** The tokens, copied from src/styles/tokens.css. Light theme — cards are not themable. */
const T = {
  paper: '#FDFAFB',
  surface: '#F7EFF2',
  ink: '#2B2129',
  muted: '#665A68',
  plum: '#7A3F63',
  blush: '#D99BB0',
  blushSoft: '#F6E4EA',
};

/**
 * Loads the TTFs `pnpm fonts` produced.
 * Throws if they are missing — the caller falls back to the static card.
 */
export async function loadOgFonts(dir = OG_FONT_DIR) {
  const usable = OG_FONTS.filter((font) => !font.fixtureOnly);
  const fonts = [];
  for (const font of usable) {
    const path = join(dir, font.to);
    if (!existsSync(path)) {
      throw new Error(`missing ${path} — run \`pnpm fonts\``);
    }
    fonts.push({
      name: font.family,
      data: await readFile(path),
      weight: font.pinWeight ?? 400,
      style: 'normal',
    });
  }
  return fonts;
}

/**
 * Every codepoint of `text` must exist in `ttfPath`.
 *
 * This is the assertion the earlier font work earned: satori silently drops a
 * glyph it cannot find, so a card can lose every Oʻ and Gʻ and still "render".
 * Checking the font's cmap directly is deterministic; eyeballing a PNG is not.
 */
export async function missingGlyphs(ttfPath, text = OG_GLYPH_FIXTURE) {
  const { openSync } = await import('fontkit');
  const font = openSync(ttfPath);
  const missing = [];
  for (const char of [...new Set([...text])]) {
    const cp = char.codePointAt(0);
    if (cp <= 0x20) continue;
    if (!font.hasGlyphForCodePoint(cp)) {
      missing.push({ char, cp, hex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0') });
    }
  }
  return missing;
}

/** Title size steps down as the title grows, so long titles wrap instead of clipping. */
export function titleSize(title) {
  const n = title.length;
  if (n <= 28) return 76;
  if (n <= 48) return 64;
  if (n <= 70) return 54;
  if (n <= 95) return 46;
  return 40;
}

/**
 * satori accepts a React-element-shaped object; no JSX pipeline needed here.
 *
 * Nulls are filtered and zero children collapse to undefined: satori rejects a
 * node that "has more than one child" without an explicit display, and an empty
 * children array counts as more than one.
 */
const h = (type, props, ...children) => {
  const kids = children.filter((child) => child !== null && child !== undefined && child !== false);
  return {
    type,
    props: {
      ...props,
      ...(kids.length === 0 ? {} : { children: kids.length === 1 ? kids[0] : kids }),
    },
  };
};

function card({ title, kicker, name }) {
  return h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: T.paper,
        padding: '64px 72px',
        position: 'relative',
      },
    },
    // Top rule, echoing the site's blush hairline.
    h('div', {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${OG_WIDTH}px`,
        height: '12px',
        backgroundColor: T.blush,
      },
    }),

    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '22px', marginTop: '18px' } },
      kicker
        ? h(
            'div',
            {
              style: {
                display: 'flex',
                // Without this the chip stretches to the column's full width:
                // a flex column stretches its children by default.
                alignSelf: 'flex-start',
                fontFamily: 'Alegreya Sans',
                fontSize: '26px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: T.plum,
                backgroundColor: T.blushSoft,
                padding: '10px 22px 12px',
                // The arch, scaled: rounded with one corner cut sharp.
                borderRadius: '18px 18px 18px 5px',
              },
            },
            kicker,
          )
        : null,
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontFamily: 'Alegreya',
            fontWeight: 600,
            fontSize: `${titleSize(title)}px`,
            lineHeight: 1.16,
            color: T.ink,
            // No maxHeight/overflow clip: satori wraps, and the size steps down
            // with length so even a 90-character Uzbek title fits.
            maxWidth: '1000px',
          },
        },
        title,
      ),
    ),

    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '18px' } },
      // The wordmark's lens dot.
      h('div', {
        style: {
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          backgroundColor: T.blush,
          border: `7px solid ${T.blushSoft}`,
        },
      }),
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontFamily: 'Alegreya Sans',
            fontSize: '30px',
            color: T.muted,
          },
        },
        name,
      ),
    ),
  );
}

/**
 * Measures a rendered text run inside satori's SVG.
 *
 * satori emits one <path> per text run with every glyph combined into a single
 * `d`, so there are no <text> elements to count and no per-line markup. Each
 * glyph starts with its own `M x,y` move, so the distinct y baselines ARE the
 * line count — which is how we tell a wrapped title from a clipped one.
 *
 * Line counting works off the vertical SPAN of the run, not off clustering the
 * y values: a glyph's `M` is the start of a contour, not its baseline, so within
 * one line the starts already scatter by most of the font size. Measured against
 * known cases, span/lineHeight is ~0.70 for one line, ~1.69 for two and ~2.48
 * for three — hence the +0.3 before rounding.
 *
 * @param {string} svg
 * @param {string} fill hex colour identifying the run (the title is --ink)
 * @param {{ fontSize?: number }} [options]
 */
export function measureTextRun(svg, fill, { fontSize } = {}) {
  const path = [...svg.matchAll(/<path([^>]*?)\sd="([^"]+)"/g)].find((m) =>
    m[1].includes(`fill="${fill}"`),
  );
  if (!path) return null;

  // satori separates glyph coordinates with a space ("M82.5 227.8") while the
  // shapes it draws itself use a comma ("M90,82"). Accept both.
  const moves = [...path[2].matchAll(/M\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
  if (moves.length === 0) return null;

  const ys = moves.map((m) => m.y);
  const span = Math.max(...ys) - Math.min(...ys);
  const lineHeight = (fontSize ?? 0) * OG_LINE_HEIGHT_RATIO;
  const lines = lineHeight > 0 ? Math.max(1, Math.round(span / lineHeight + 0.3)) : 1;

  return {
    lines,
    span,
    glyphs: moves.length,
    minX: Math.min(...moves.map((m) => m.x)),
    maxX: Math.max(...moves.map((m) => m.x)),
    maxY: Math.max(...moves.map((m) => m.y)),
  };
}

/**
 * Renders a card to PNG. Throws on failure — every caller treats that as
 * "use the static fallback", never as a build error.
 */
/**
 * @param {{ title: string, kicker?: string, name?: string, fonts?: unknown[] }} options
 * @returns {Promise<{ png: Buffer, svg: string }>}
 */
export async function renderOgCard({ title, kicker, name = 'Malika Bobonazarova', fonts }) {
  const satori = (await import('satori')).default;
  const { Resvg } = await import('@resvg/resvg-js');

  const svg = await satori(card({ title, kicker, name }), {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: fonts ?? (await loadOgFonts()),
  });

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } })
    .render()
    .asPng();

  return { png, svg };
}
