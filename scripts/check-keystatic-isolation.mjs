#!/usr/bin/env node
/**
 * Keystatic pulls in React and a large editor bundle. That is fine on /keystatic
 * and unacceptable anywhere else, and it is the main performance risk the CMS
 * introduces — a stray `client:` directive or a shared import would quietly ship
 * React to every reader on a 4G connection in Tashkent.
 *
 * Asserts, against the built output a visitor is actually served:
 *   1. no public page references React, Keystatic or any hydration runtime
 *   2. the only inline scripts on a public page are the two known prefs snippets
 *      (plus JSON-LD, which is data, not code)
 *   3. /keystatic and /api/keystatic are NOT prerendered into the static output
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';

import { resolveDistDir } from './lib/browser.mjs';

const dist = resolveDistDir();
const pages = globSync(`${dist}/**/*.html`);

if (pages.length === 0) {
  console.error(`check-keystatic-isolation: no built HTML under ${dist}/ — run \`pnpm build\`.`);
  process.exit(1);
}

/** Substrings that must never appear in a public page's markup or its assets. */
const FORBIDDEN = [
  'keystatic',
  'react-dom',
  'astro-island', // Astro's hydration wrapper — no islands on public pages
  'client:load',
  'client:idle',
  'client:visible',
];

let failures = 0;

for (const page of pages.sort()) {
  const html = readFileSync(page, 'utf8');
  const route = page.replace(dist, '') || '/';

  /*
   * Only code counts. The admin bar legitimately LINKS to /keystatic, so a raw
   * substring search over the whole document flags an <a href> as a bundle leak.
   * What matters is script sources, module preloads and inline script bodies.
   */
  const code = [
    ...[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<link\b[^>]*\brel=["'](?:modulepreload|preload)["'][^>]*\bhref=["']([^"']+)["']/gi)].map(
      (m) => m[1],
    ),
    ...[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
      .filter((m) => !/application\/ld\+json/i.test(m[0]))
      .map((m) => m[1]),
  ]
    .join('\n')
    .toLowerCase();

  const hits = FORBIDDEN.filter(
    (needle) => code.includes(needle) || (needle === 'astro-island' && html.includes(needle)),
  );
  if (hits.length > 0) {
    console.error(`  FAIL ${route} references in code: ${hits.join(', ')}`);
    failures += 1;
    continue;
  }

  // Every <script> must be one we put there on purpose.
  const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1] ?? '');
  const unexpected = scripts.filter(
    (attrs) => !/type=["']application\/ld\+json["']/i.test(attrs) && /src=/i.test(attrs),
  );
  if (unexpected.length > 0) {
    console.error(`  FAIL ${route} loads an external script: ${unexpected.join(' | ')}`);
    failures += 1;
  }
}

/*
 * On-demand routes must NOT be baked into the static output. For the CMS that is
 * about bundle size; for /admin it is about access — a prerendered admin page is
 * a static file the web server hands to anyone, which is exactly why the auth
 * middleware needs it rendered on demand.
 */
const leaked = globSync(`${dist}/{keystatic,api,admin}/**/*.html`);
if (leaked.length > 0) {
  console.error(`  FAIL on-demand routes were prerendered into ${dist}: ${leaked.join(', ')}`);
  console.error('       A prerendered /admin page bypasses the auth middleware entirely.');
  failures += 1;
}

if (failures > 0) {
  console.error(`\ncheck-keystatic-isolation: ${failures} problem(s).`);
  process.exit(1);
}

console.log(
  `check-keystatic-isolation: ${pages.length} public pages carry no React, ` +
    'no Keystatic and no hydration runtime.',
);
