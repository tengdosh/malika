// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import { SITE } from './src/lib/site.js';

/**
 * Reports font-glyph coverage at the end of every build, including on Vercel and
 * Cloudflare. It never fails the build: a character Malika typed must not stop a
 * deploy, and a warning nobody sees in CI is a warning nobody sees at all.
 * `pnpm check` runs the same analysis and does fail on UI-authored gaps.
 *
 * @returns {import('astro').AstroIntegration}
 */
const glyphCoverageReport = () => ({
  name: 'glyph-coverage-report',
  hooks: {
    'astro:build:done': async ({ logger }) => {
      const { analyseGlyphCoverage, reportGlyphCoverage } = await import(
        './scripts/lib/glyph-coverage.mjs'
      );
      reportGlyphCoverage(analyseGlyphCoverage(), {
        log: (message) => logger.info(message),
        warn: (message) => logger.warn(message),
        // Reported through warn on purpose — this hook never fails a deploy.
        error: (message) => logger.warn(message),
      });
    },
  },
});

export default defineConfig({
  site: SITE.origin,
  output: 'static',
  trailingSlash: 'never',
  // The whole stylesheet is small; inlining removes a render-blocking round trip,
  // which is the single biggest LCP lever on a slow mobile connection.
  build: { inlineStylesheets: 'always' },
  integrations: [
    mdx(),
    // The admin area is never indexed: excluded here, noindex in the page head,
    // Disallowed in robots.txt, and behind basic auth at the edge.
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/admin') }),
    glyphCoverageReport(),
  ],
  markdown: {
    shikiConfig: { theme: 'github-light', wrap: true },
  },
  image: {
    // No remote images anywhere on this site.
    remotePatterns: [],
  },
  devToolbar: { enabled: false },
});
