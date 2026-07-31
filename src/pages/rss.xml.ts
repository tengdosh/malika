import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';

import { getPosts, entryHref } from '../lib/entries';
import { SITE } from '../lib/site.js';

export const GET: APIRoute = async (context) => {
  const posts = await getPosts();

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site ?? SITE.origin,
    trailingSlash: false,
    customData: '<language>uz</language>',
    items: posts.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.date,
      link: entryHref(entry),
    })),
  });
};
