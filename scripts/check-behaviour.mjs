#!/usr/bin/env node
/**
 * The two behaviours that are easy to claim and easy to get wrong:
 *
 *   - theme and text size persist across reloads, and are correct in the FIRST
 *     painted frame (no flash of the wrong state)
 *   - the hero entrance animation runs normally, and does not exist at all under
 *     prefers-reduced-motion — with the content rendered either way
 */
import puppeteer from 'puppeteer-core';
import { findChrome, serveDist, CHROME_ARGS } from './lib/browser.mjs';

const { server, origin } = await serveDist();
const browser = await puppeteer.launch({ executablePath: findChrome(), args: CHROME_ARGS });

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${name}${detail ? `  (${detail})` : ''}`);
  } else {
    console.error(`  FAIL ${name}${detail ? `  (${detail})` : ''}`);
    failures += 1;
  }
};

/** Records document state during the first animation frame, before anything paints. */
const captureFirstFrame = `
  window.__firstFrame = new Promise((resolve) => {
    requestAnimationFrame(() => {
      const el = document.documentElement;
      resolve({
        theme: el.getAttribute('data-theme'),
        textsize: el.getAttribute('data-textsize'),
        rootFontSize: getComputedStyle(el).fontSize,
        background: getComputedStyle(document.body).backgroundColor,
      });
    });
  });
`;

// ---------------------------------------------------------------- persistence
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${origin}/`, { waitUntil: 'networkidle0' });

  // Choose the largest text size and the theme opposite to the current one.
  await page.click('.prefs button[data-size="xl"]');
  await page.click('[data-theme-toggle]');

  const chosen = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    textsize: document.documentElement.getAttribute('data-textsize'),
    storedTheme: localStorage.getItem('theme'),
    storedSize: localStorage.getItem('textsize'),
  }));

  check('text size control applies', chosen.textsize === 'xl', `data-textsize=${chosen.textsize}`);
  check('choices are written to localStorage', chosen.storedSize === 'xl' && !!chosen.storedTheme);

  // Reload a *different* page to prove it persists site-wide, not just per page.
  await page.evaluateOnNewDocument(captureFirstFrame);
  await page.goto(`${origin}/yozuvlar`, { waitUntil: 'networkidle0' });
  const first = await page.evaluate(() => window.__firstFrame);

  check(
    'text size correct in the first painted frame',
    first.textsize === 'xl' && first.rootFontSize === '20px',
    `${first.textsize}, root ${first.rootFontSize}`,
  );
  check(
    'theme correct in the first painted frame',
    first.theme === chosen.theme,
    `${first.theme}, body ${first.background}`,
  );

  // aria-pressed must end up in sync for assistive tech.
  const pressed = await page.evaluate(() => ({
    size: document.querySelector('.prefs button[data-size="xl"]')?.getAttribute('aria-pressed'),
    theme: document.querySelector('[data-theme-toggle]')?.getAttribute('aria-pressed'),
  }));
  check(
    'aria-pressed reflects the restored state',
    pressed.size === 'true' && pressed.theme === String(chosen.theme === 'dark'),
    `size=${pressed.size} theme=${pressed.theme}`,
  );

  await page.close();
}

// -------------------------------------------------------------- system theme
{
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.evaluateOnNewDocument(captureFirstFrame);
  await page.goto(`${origin}/`, { waitUntil: 'networkidle0' });
  const first = await page.evaluate(() => window.__firstFrame);
  check(
    'prefers-color-scheme respected on a first visit',
    first.theme === 'dark',
    `data-theme=${first.theme}`,
  );
  await page.close();
}

// ------------------------------------------------------------------- motion
for (const motion of ['no-preference', 'reduce']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: motion }]);
  await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });

  const state = await page.evaluate(() => {
    const hero = document.querySelector('.hero h1');
    return {
      animations: document.getAnimations().length,
      heroInDom: Boolean(hero) && (hero?.textContent?.trim().length ?? 0) > 0,
      heroOpacity: hero ? parseFloat(getComputedStyle(hero).opacity) : -1,
    };
  });

  if (motion === 'no-preference') {
    check('hero animation runs by default', state.animations > 0, `${state.animations} animations`);
  } else {
    check('hero animation absent under reduced motion', state.animations === 0);
    check(
      'hero fully visible immediately under reduced motion',
      state.heroOpacity === 1,
      `opacity ${state.heroOpacity}`,
    );
  }

  // The content is in the DOM regardless of motion preference.
  check(`hero content present in the DOM (${motion})`, state.heroInDom);
  await page.close();
}

await browser.close();
server.close();

if (failures > 0) {
  console.error(`\ncheck-behaviour: ${failures} problem(s).`);
  process.exit(1);
}
console.log('\ncheck-behaviour: clean.');
