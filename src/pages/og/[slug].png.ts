import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';

import { getPosts, getNotes, entrySlug, type Entry } from '../../lib/entries';
import { PILLAR_LABEL } from '../../lib/pillars';

/**
 * Per-post Open Graph cards, rendered at build time.
 *
 * Prerendered like every other route — satori and resvg run on the build
 * machine, never in a request. See scripts/lib/og-card.mjs for the design.
 *
 * This endpoint CANNOT fail. If rendering throws for any reason — a missing
 * font, a satori layout complaint, anything — it serves the static
 * public/og-default.png instead and logs a warning. A broken share preview is a
 * bad day; a broken deploy is a worse one.
 */
export const getStaticPaths = (async () => {
  const entries: Entry[] = [...(await getPosts()), ...(await getNotes())];
  return entries.map((entry) => ({ params: { slug: entrySlug(entry) }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const entry = props.entry as Entry;
  const headers = {
    'content-type': 'image/png',
    'cache-control': 'public, max-age=31536000, immutable',
  };

  try {
    const { renderOgCard } = await import('../../../scripts/lib/og-card.mjs');
    const { png } = await renderOgCard({
      title: entry.data.title,
      kicker: PILLAR_LABEL[entry.data.pillar],
    });
    return new Response(new Uint8Array(png), { headers });
  } catch (error) {
    console.warn(
      `[og] ${entry.collection}/${entry.id}: card generation failed, ` +
        `falling back to og-default.png — ${(error as Error).message}`,
    );
    // The build continues either way; this is the whole point of the try/catch.
    const fallback = await readFile('public/og-default.png');
    return new Response(new Uint8Array(fallback), { headers });
  }
};
