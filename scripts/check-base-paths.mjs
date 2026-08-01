#!/usr/bin/env node
/**
 * Every internal link must carry the base path.
 *
 * This exists because a real bug shipped: two Markdown links written as
 * `[Hozir](/hozir)` rendered as `/hozir`, which on a subpath deployment points
 * at the domain root and 404s. Astro applies `base` to its own asset URLs and
 * components go through withBase(), but Markdown content does neither.
 *
 * The check builds with a deliberately distinctive base and then scans every
 * built page for a root-absolute href/src that does not carry it. It has to
 * build its own way: the default configuration has no base at all, so a check
 * run against it would pass no matter how many links were broken.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';

const TEST_BASE = '/__basecheck';

/** Values that are correct without a base. */
const isExempt = (value) =>
  !value.startsWith('/') || // relative, or a scheme like https:/mailto:
  value.startsWith('//') || // protocol-relative
  value.startsWith('/#'); // in-page anchor

console.log(`  building with base=${TEST_BASE} …`);
const build = spawnSync('pnpm', ['exec', 'astro', 'build'], {
  stdio: 'pipe',
  encoding: 'utf8',
  env: { ...process.env, SITE_BASE: TEST_BASE, PUBLIC_NOINDEX: '1' },
});

let failures = 0;

try {
  if (build.status !== 0) {
    console.error('  FAIL the build failed under a base path');
    console.error((build.stdout ?? '') + (build.stderr ?? ''));
    process.exit(1);
  }

  const pages = globSync('dist/client/**/*.html');
  if (pages.length === 0) {
    console.error('  FAIL no built pages to inspect');
    process.exit(1);
  }

  const offenders = new Map(); // value -> [pages]

  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    for (const match of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      const value = match[1];
      if (isExempt(value)) continue;
      if (value === TEST_BASE || value.startsWith(`${TEST_BASE}/`)) continue;

      const route = page.replace('dist/client', '').replace(/\/index\.html$/, '') || '/';
      if (!offenders.has(value)) offenders.set(value, []);
      if (!offenders.get(value).includes(route)) offenders.get(value).push(route);
    }
  }

  if (offenders.size > 0) {
    failures = offenders.size;
    console.error(`\n  FAIL ${offenders.size} link(s) ignore the base path:\n`);
    for (const [value, routes] of offenders) {
      console.error(`    ${value}`);
      console.error(`      on: ${routes.slice(0, 4).join(', ')}${routes.length > 4 ? ' …' : ''}`);
    }
    console.error(
      '\n  In a component, wrap the path in withBase(). In Markdown, nothing —' +
        '\n  scripts/lib/rehype-base-path.mjs is supposed to handle it, so a hit' +
        '\n  here means that plugin missed an element or is not wired up.',
    );
  } else {
    const links = pages.reduce(
      (total, page) =>
        total + [...readFileSync(page, 'utf8').matchAll(/\s(?:href|src)="\//g)].length,
      0,
    );
    console.log(`  ok   ${links} absolute links across ${pages.length} pages all carry the base`);
  }
} finally {
  // Leave dist/ matching the ambient configuration, not the test base.
  try {
    execFileSync('pnpm', ['exec', 'astro', 'build'], { stdio: 'pipe' });
  } catch {
    console.error('  warning: rebuild after the base check failed — run `pnpm build`');
  }
}

if (failures > 0) {
  console.error(`\ncheck-base-paths: ${failures} problem(s).`);
  process.exit(1);
}
console.log('\ncheck-base-paths: every internal link respects the base.');
