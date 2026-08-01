// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import node from '@astrojs/node';

import { fileURLToPath } from 'node:url';

import { SITE } from './src/lib/site.js';

/**
 * Deploy target. Defaults to the canonical domain at the root; the live
 * deployment on tengdosh.uzjoku.uz overrides both, because it is served from a
 * subpath under someone else's domain.
 *
 *   SITE_ORIGIN=https://tengdosh.uzjoku.uz  SITE_BASE=/malika  pnpm build
 */
const ORIGIN = process.env.SITE_ORIGIN || SITE.origin;
const BASE = process.env.SITE_BASE || '/';

/**
 * IndexNow ping on every deploy. Warns on failure, never fails the build, and
 * refuses to submit a noindexed preview.
 *
 * @returns {import('astro').AstroIntegration}
 */
const indexNowSubmit = () => ({
  name: 'indexnow-submit',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const {
        indexNowConfig,
        writeKeyFile,
        collectUrls,
        submitUrls,
      } = await import('./scripts/lib/indexnow.mjs');

      const config = indexNowConfig({
        origin: ORIGIN,
        noindex: process.env.PUBLIC_NOINDEX === '1',
      });

      if (!config.ok) {
        logger.info(`IndexNow skipped: ${config.reason}`);
        return;
      }

      const distDir = fileURLToPath(dir).replace(/\/$/, '');
      try {
        await writeKeyFile(distDir, config.key);
        const urls = collectUrls(distDir, config.origin);
        const result = await submitUrls({ ...config, urls });
        if (result.error) {
          logger.warn(`IndexNow submission failed (not fatal): ${result.error}`);
        } else {
          logger.info(`IndexNow: submitted ${result.submitted} URLs, HTTP ${result.status}`);
        }
      } catch (error) {
        // Never fatal. A search engine is not worth a failed deploy.
        logger.warn(`IndexNow step failed (not fatal): ${/** @type {Error} */ (error).message}`);
      }
    },
  },
});

/**
 * Reports font-glyph coverage at the end of every build, including on the host.
 * It never fails the build: a character Malika typed must not stop a deploy, and
 * a warning nobody sees in CI is a warning nobody sees at all. `pnpm check` runs
 * the same analysis and does fail on UI-authored gaps.
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
  site: ORIGIN,
  base: BASE,

  /**
   * Still 'static': every public page is prerendered exactly as before. The
   * adapter exists only so Keystatic's two injected routes (/keystatic and
   * /api/keystatic/[...params]) can render on demand — they are the only
   * on-demand routes in the project, and scripts/check-keystatic-isolation.mjs
   * asserts no Keystatic JS reaches a public page.
   */
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'never',
  // The whole stylesheet is small; inlining removes a render-blocking round trip,
  // which is the single biggest LCP lever on a slow mobile connection.
  build: { inlineStylesheets: 'always' },
  integrations: [
    mdx(),
    // The admin area is never indexed: excluded here, noindex in the page head,
    // Disallowed in robots.txt, and behind basic auth at the edge.
    sitemap({
      filter: (page) => {
        const { pathname } = new URL(page);
        return !pathname.startsWith('/admin') && !pathname.startsWith('/keystatic');
      },
    }),
    react(),
    keystatic(),
    glyphCoverageReport(),
    indexNowSubmit(),
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
