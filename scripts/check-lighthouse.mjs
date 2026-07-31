#!/usr/bin/env node
/**
 * Lighthouse mobile against the audit routes, with a hard budget.
 *
 * Uzbekistan is ~91% mobile and speeds drop sharply outside the big cities, so
 * these are build-failing thresholds, not aspirations.
 *
 * Two runs per route, because they answer different questions:
 *
 *   simulate  (Lighthouse's default) — Lantern predicts timings from a fast
 *             trace. This is what produces the category scores everyone quotes,
 *             so the SCORE budget is gated here.
 *   devtools  — the same 4G conditions (150ms RTT, 1.6 Mbps, 4x CPU) actually
 *             applied to the browser and measured. This is what a real phone
 *             experiences, so the LCP budget is gated here.
 *
 * For this site Lantern predicts ~1.8s LCP where applied throttling measures
 * ~0.6s. Both numbers are printed on every run; neither is hidden. See the
 * README "Performance" section for the reasoning and the measured floor.
 */
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

import { findChrome, serveDist } from './lib/browser.mjs';
import { AUDIT_ROUTES } from '../src/lib/site.js';

const SCORE_BUDGET = {
  performance: 95,
  accessibility: 100,
  'best-practices': 95,
  seo: 100,
};

/** LCP ceiling, measured under applied 4G throttling. */
const LCP_MS = 1500;

/**
 * Applied throttling measures a real page load, so it picks up whatever else the
 * machine is doing. Five consecutive runs of the homepage spread 597-637ms, but a
 * single run taken right after a build spiked to 2288ms. Median of three keeps CI
 * honest without making it flaky.
 */
const LCP_RUNS = 3;

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Lighthouse's mobile 4G profile, shared by both runs so they are comparable. */
const THROTTLING = {
  rttMs: 150,
  throughputKbps: 1638.4,
  requestLatencyMs: 150,
  downloadThroughputKbps: 1638.4,
  uploadThroughputKbps: 750,
  cpuSlowdownMultiplier: 4,
};

process.env.CHROME_PATH = findChrome();

const { server, origin } = await serveDist();
const chrome = await chromeLauncher.launch({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

const run = (route, throttlingMethod) =>
  lighthouse(origin + route, {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    throttlingMethod,
    ...(throttlingMethod === 'devtools' && { throttling: THROTTLING }),
  });

let failures = 0;

for (const route of AUDIT_ROUTES) {
  const simulated = (await run(route, 'simulate'))?.lhr;

  const appliedRuns = [];
  for (let i = 0; i < LCP_RUNS; i += 1) {
    const lhr = (await run(route, 'devtools'))?.lhr;
    if (lhr) appliedRuns.push(lhr);
  }

  if (!simulated || appliedRuns.length === 0) {
    console.error(`  FAIL ${route} — Lighthouse returned no result`);
    failures += 1;
    continue;
  }

  const scores = Object.fromEntries(
    Object.keys(SCORE_BUDGET).map((key) => [
      key,
      Math.round((simulated.categories[key]?.score ?? 0) * 100),
    ]),
  );
  const lcpSamples = appliedRuns.map(
    (lhr) => lhr.audits['largest-contentful-paint']?.numericValue ?? Infinity,
  );
  const lcp = median(lcpSamples);
  const lcpSimulated = simulated.audits['largest-contentful-paint']?.numericValue ?? Infinity;

  const problems = [];
  for (const [key, min] of Object.entries(SCORE_BUDGET)) {
    if (scores[key] < min) problems.push(`${key} ${scores[key]} < ${min}`);
  }
  if (lcp > LCP_MS) problems.push(`LCP ${Math.round(lcp)}ms > ${LCP_MS}ms (applied throttling)`);

  const summary =
    `perf ${scores.performance}  a11y ${scores.accessibility}  ` +
    `bp ${scores['best-practices']}  seo ${scores.seo}  ` +
    `LCP ${Math.round(lcp)}ms applied (median of ${lcpSamples.length}: ` +
    `${lcpSamples.map((v) => Math.round(v)).join(', ')})` +
    ` / ${Math.round(lcpSimulated)}ms Lantern`;

  if (problems.length > 0) {
    failures += problems.length;
    console.error(`  FAIL ${route}`);
    console.error(`       ${summary}`);
    problems.forEach((p) => console.error(`       ${p}`));
  } else {
    console.log(`  ok   ${route}`);
    console.log(`       ${summary}`);
  }
}

await chrome.kill();
server.close();

if (failures > 0) {
  console.error(`\ncheck-lighthouse: ${failures} budget breach(es).`);
  process.exit(1);
}
console.log('\ncheck-lighthouse: within budget.');
