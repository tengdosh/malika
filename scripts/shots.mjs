#!/usr/bin/env node
/** Dev helper: screenshot a set of routes from dist/ for visual review. */
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { findChrome, serveDist, CHROME_ARGS } from './lib/browser.mjs';

const OUT = process.env.SHOT_DIR ?? '.shots';
const routes = process.argv.slice(2);
if (routes.length === 0) routes.push('/');

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 1000, deviceScaleFactor: 1 },
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
];

await mkdir(OUT, { recursive: true });
const { server, origin } = await serveDist();
const browser = await puppeteer.launch({ executablePath: findChrome(), args: CHROME_ARGS });

for (const route of routes) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    if (process.env.THEME === 'dark') {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    }
    await page.goto(origin + route, { waitUntil: 'networkidle0' });

    // Scroll the whole page so lazy-loaded images below the fold actually fetch;
    // a fullPage screenshot alone captures them as empty boxes.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () =>
        Promise.all(
          [...document.images].filter((img) => !img.complete).map(
            (img) => new Promise((resolve) => { img.onload = img.onerror = resolve; }),
          ),
        ),
    );

    const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
    const suffix = process.env.THEME === 'dark' ? '-dark' : '';
    const file = `${OUT}/${slug}-${vp.name}${suffix}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  ${file}`);
    await page.close();
  }
}

await browser.close();
server.close();
