#!/usr/bin/env node
/**
 * axe against /, a post page and /men-haqimda — in BOTH themes. Zero violations.
 *
 * Also asserts a few things axe cannot see but the spec requires:
 *   - no interface text below the 13px floor
 *   - no opacity applied to text
 *   - one h1 per page, no heading level skips
 *   - no horizontal scroll at 200% text size
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

import { findChrome, serveDist, CHROME_ARGS } from './lib/browser.mjs';
import { startNodeServer } from './lib/node-server.mjs';
import { AUDIT_ROUTES, A11Y_ONLY_ROUTES } from '../src/lib/site.js';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const { server, origin } = await serveDist();

/*
 * The admin page is rendered on demand now (it has to be, for the auth
 * middleware to run), so it is not in the static output. It is audited against
 * the real built server instead, with credentials supplied.
 */
const ADMIN_USER = 'a11y';
const ADMIN_PASSWORD = 'a11y-fixture-password';
const appServer = A11Y_ONLY_ROUTES.length
  ? await startNodeServer({ port: 4490, env: { ADMIN_USER, ADMIN_PASSWORD } })
  : null;

const browser = await puppeteer.launch({ executablePath: findChrome(), args: CHROME_ARGS });

let failures = 0;

/** Structural checks axe does not cover. */
const structuralAudit = () => {
  const problems = [];

  // Settle the hero entrance animation first. It legitimately animates opacity
  // from 0 to 1; the rule below is about *static* opacity used to make text
  // recede, which is what previously failed contrast.
  document.getAnimations().forEach((animation) => animation.finish());

  // 1. Type floor: no rendered interface text under 13px.
  const FLOOR = 13;
  document.querySelectorAll('body *').forEach((el) => {
    if (!el.textContent?.trim()) return;
    if (el.children.length > 0) return; // leaf nodes only
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    if (el.closest('.visually-hidden')) return;
    const size = parseFloat(style.fontSize);
    if (size < FLOOR - 0.01) {
      problems.push(`text below ${FLOOR}px: ${size.toFixed(2)}px on <${el.tagName.toLowerCase()}>`);
    }
  });

  // 2. No opacity on text. Every earlier attempt at this failed contrast.
  document.querySelectorAll('body *').forEach((el) => {
    if (!el.textContent?.trim()) return;
    const opacity = parseFloat(getComputedStyle(el).opacity);
    if (opacity < 1) {
      problems.push(`opacity ${opacity} on text in <${el.tagName.toLowerCase()}>`);
    }
  });

  // 3. Exactly one h1, and no skipped heading levels.
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const h1s = headings.filter((h) => h.tagName === 'H1');
  if (h1s.length !== 1) problems.push(`${h1s.length} <h1> elements (expected exactly 1)`);

  let previous = 0;
  for (const heading of headings) {
    const level = Number(heading.tagName[1]);
    if (previous && level > previous + 1) {
      problems.push(`heading skip: h${previous} -> h${level} ("${heading.textContent?.trim().slice(0, 40)}")`);
    }
    previous = level;
  }

  // 4. No horizontal scroll.
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    problems.push(
      `horizontal scroll: content ${document.documentElement.scrollWidth}px > viewport ${window.innerWidth}px`,
    );
  }

  return problems;
};

const ROUTES = [
  ...AUDIT_ROUTES.map((route) => ({ route, base: origin, auth: false })),
  ...A11Y_ONLY_ROUTES.map((route) => ({ route, base: appServer?.origin ?? origin, auth: true })),
];

for (const { route, base, auth } of ROUTES) {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    if (auth) await page.authenticate({ username: ADMIN_USER, password: ADMIN_PASSWORD });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
    await page.goto(base + route, { waitUntil: 'networkidle0' });

    await page.evaluate(axeSource);
    const results = await page.evaluate(async () => {
      // @ts-ignore - injected above
      return await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      });
    });

    const label = `${route} [${theme}]`;

    if (results.violations.length > 0) {
      failures += results.violations.length;
      console.error(`  FAIL ${label} — ${results.violations.length} axe violation(s)`);
      for (const v of results.violations) {
        console.error(`       ${v.id} (${v.impact}): ${v.help}`);
        for (const node of v.nodes.slice(0, 3)) {
          console.error(`         ${node.html.slice(0, 120)}`);
        }
      }
    }

    const structural = await page.evaluate(structuralAudit);
    if (structural.length > 0) {
      failures += structural.length;
      console.error(`  FAIL ${label} — structural`);
      structural.forEach((p) => console.error(`       ${p}`));
    }

    // 200% text size, via the site's own control rather than browser zoom.
    await page.evaluate(() => document.documentElement.style.setProperty('--base', '200%'));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    if (overflow) {
      failures += 1;
      console.error(`  FAIL ${label} — horizontal scroll at 200% text size`);
    }

    if (results.violations.length === 0 && structural.length === 0 && !overflow) {
      console.log(`  ok   ${label} (${results.passes.length} axe checks passed)`);
    }

    await page.close();
  }
}

await browser.close();
server.close();
appServer?.stop();

if (failures > 0) {
  console.error(`\ncheck-a11y: ${failures} problem(s).`);
  process.exit(1);
}
console.log('\ncheck-a11y: clean.');
