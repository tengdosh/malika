// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import { SITE } from './src/lib/site.js';

export default defineConfig({
  site: SITE.origin,
  output: 'static',
  trailingSlash: 'never',
  // The whole stylesheet is small; inlining removes a render-blocking round trip,
  // which is the single biggest LCP lever on a slow mobile connection.
  build: { inlineStylesheets: 'always' },
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: { theme: 'github-light', wrap: true },
  },
  image: {
    // No remote images anywhere on this site.
    remotePatterns: [],
  },
  devToolbar: { enabled: false },
});
