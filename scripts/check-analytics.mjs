#!/usr/bin/env node
/**
 * Integration test for the analytics pipeline, against a mock Umami API.
 *
 * Proves the three things that actually matter operationally:
 *
 *   1. with a working API, real counts are baked into the static HTML —
 *      on the stats page and in each post's byline
 *   2. no API key and no client-side request end up in the output
 *   3. with the API unreachable, `pnpm build` still SUCCEEDS and posts render
 *      with no counter — a stats outage must never block a deploy
 *
 * Also checks that the hisoblagichKorsatilsin / hisoblagichMinimum switches in
 * the sozlamalar singleton take effect.
 */
import { execFileSync, fork } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

import { POST_VIEWS, TOTALS } from './lib/mock-umami.mjs';
import { resolveDistDir } from './lib/browser.mjs';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${name}${detail ? `  (${detail})` : ''}`);
  } else {
    console.error(`  FAIL ${name}${detail ? `  (${detail})` : ''}`);
    failures += 1;
  }
};

/**
 * The mock runs in a FORKED process. execFileSync below blocks this process's
 * event loop, so a server living here could never answer the build's requests —
 * every fetch would fail and the whole test would pass vacuously by "failing"
 * exactly as the outage case is supposed to.
 */
function startMock(port) {
  return new Promise((resolve, reject) => {
    // 'ipc' must be listed explicitly: passing stdio:'pipe' to fork() replaces
    // the default ['pipe','pipe','pipe','ipc'] and silently drops the channel,
    // so the ready message never arrives.
    const child = fork('scripts/lib/mock-umami.mjs', [String(port)], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    const timer = setTimeout(() => reject(new Error('mock did not start')), 10_000);
    child.on('message', (message) => {
      if (message === 'ready') {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.on('error', reject);
  });
}

const build = (env) => {
  execFileSync('pnpm', ['exec', 'astro', 'build'], {
    stdio: 'pipe',
    env: { ...process.env, ...env },
  });
};

const read = (path) => readFileSync(path, 'utf8');
// Keystatic lays singletons out as <name>/index.<ext>.
const SETTINGS = 'src/content/site/sozlamalar/index.yaml';
const originalSettings = read(SETTINGS);

const PORT = 4477;
const server = await startMock(PORT);

const WORKING_ENV = {
  ANALYTICS_PROVIDER: 'umami',
  UMAMI_API_URL: `http://127.0.0.1:${PORT}`,
  UMAMI_WEBSITE_ID: 'test-site',
  UMAMI_API_KEY: 'test-key-do-not-ship',
};

try {
  // 1 — working API
  build(WORKING_ENV);

  const post = read(`${resolveDistDir()}/yozuvlar/navbatchilikdan-keyin/index.html`);
  check(
    'post byline carries the baked-in count',
    post.includes('1 247 marta oʻqildi'),
    `${POST_VIEWS['/yozuvlar/navbatchilikdan-keyin']} -> "1 247 marta oʻqildi"`,
  );

  const stats = read(`${resolveDistDir()}/admin/statistika/index.html`);
  check('stats page shows visit totals', stats.includes('1 030'), `visits ${TOTALS.visits}`);
  check(
    'stats page lists a real post with its count',
    stats.includes('Navbatchilikdan keyin') && stats.includes('1 247'),
  );
  check('stats page shows referrers', stats.includes('google.com'));
  check('stats page shows places', stats.includes('UZ'));

  // grep exits 1 when it finds nothing, which is the passing case here.
  let keyLeaked = true;
  try {
    execFileSync('grep', ['-rq', 'test-key-do-not-ship', 'dist'], { stdio: 'pipe' });
  } catch {
    keyLeaked = false;
  }
  check('API key never reaches the output', !keyLeaked);

  // 2 — zero client JS added: no analytics fetch in any post page
  check(
    'no client-side analytics request on a post page',
    !/fetch\(|XMLHttpRequest|umami|plausible/i.test(post),
  );

  // 3 — minimum threshold
  writeFileSync(SETTINGS, originalSettings.replace('hisoblagichMinimum: 0', 'hisoblagichMinimum: 100'));
  build(WORKING_ENV);
  check(
    'hisoblagichMinimum hides counts below the threshold',
    read(`${resolveDistDir()}/yozuvlar/navbatchilikdan-keyin/index.html`).includes('marta oʻqildi') &&
      !read(`${resolveDistDir()}/yozuvlar/nega-oftalmologiya/index.html`).includes('marta oʻqildi'),
    '1247 shown, 12 hidden',
  );

  // 4 — master switch
  writeFileSync(
    SETTINGS,
    originalSettings.replace('hisoblagichKorsatilsin: true', 'hisoblagichKorsatilsin: false'),
  );
  build(WORKING_ENV);
  check(
    'hisoblagichKorsatilsin false removes every counter',
    !read(`${resolveDistDir()}/yozuvlar/navbatchilikdan-keyin/index.html`).includes('marta oʻqildi'),
  );
  writeFileSync(SETTINGS, originalSettings);

  // 5 — the one that matters most: API down, build must still succeed
  let buildSucceeded = true;
  try {
    build({
      ANALYTICS_PROVIDER: 'umami',
      UMAMI_API_URL: 'http://127.0.0.1:9', // discard port — connection refused
      UMAMI_WEBSITE_ID: 'test-site',
      UMAMI_API_KEY: 'test-key-do-not-ship',
    });
  } catch {
    buildSucceeded = false;
  }
  check('build SUCCEEDS with the analytics API unreachable', buildSucceeded);

  if (buildSucceeded) {
    check(
      'posts render with no counter when analytics is down',
      !read(`${resolveDistDir()}/yozuvlar/navbatchilikdan-keyin/index.html`).includes('marta oʻqildi'),
    );
    check(
      'stats page explains itself instead of showing zeroes',
      read(`${resolveDistDir()}/admin/statistika/index.html`).includes('Hozircha maʼlumot yoʻq'),
    );
  }
} finally {
  writeFileSync(SETTINGS, originalSettings);
  server.kill();
  // Leave dist/ matching the real (unconfigured) environment.
  try {
    execFileSync('pnpm', ['exec', 'astro', 'build'], { stdio: 'pipe' });
  } catch {
    console.error('  warning: final rebuild failed — run `pnpm build` manually');
  }
}

if (failures > 0) {
  console.error(`\ncheck-analytics: ${failures} problem(s).`);
  process.exit(1);
}
console.log('\ncheck-analytics: clean.');
