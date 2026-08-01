#!/usr/bin/env node
/**
 * Stand-in for a self-hosted Umami v2 instance, used by check-analytics.mjs.
 *
 * Runs as its OWN process, forked by the test. That is not incidental: the test
 * drives builds with execFileSync, which blocks the parent's event loop, so a
 * server living in the parent could never answer the build's requests.
 *
 * Signals readiness over IPC, then serves until killed.
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const POST_VIEWS = {
  '/yozuvlar/navbatchilikdan-keyin': 1247,
  '/yozuvlar/yozgi-kitoblar': 318,
  '/yozuvlar/koz-oldidagi-chivinlar': 96,
  '/yozuvlar/nega-oftalmologiya': 12,
  '/qaydlar/koz-anatomiyasi': 47,
};

export const REFERRERS = [
  { x: 't.me', y: 412 },
  { x: '', y: 260 }, // direct — the adapter labels this "Toʻgʻridan-toʻgʻri"
  { x: 'google.com', y: 188 },
];

export const COUNTRIES = [
  { x: 'UZ', y: 703 },
  { x: 'KZ', y: 64 },
];

export const TOTALS = { pageviews: 1720, visitors: 880, visits: 1030 };

/**
 * Only start listening when run as a script.
 *
 * check-analytics.mjs imports the fixture data above from this same file; without
 * this guard that import would start a second server in the parent process,
 * take the port, and make the forked child die with EADDRINUSE before it could
 * report ready.
 */
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

const port = Number(process.argv[2] ?? 4477);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  const send = (body) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if (url.pathname.endsWith('/stats')) {
    return send({
      pageviews: { value: TOTALS.pageviews, prev: 0 },
      visitors: { value: TOTALS.visitors, prev: 0 },
      visits: { value: TOTALS.visits, prev: 0 },
    });
  }

  if (url.pathname.endsWith('/metrics')) {
    const type = url.searchParams.get('type');
    if (type === 'url') return send(Object.entries(POST_VIEWS).map(([x, y]) => ({ x, y })));
    if (type === 'referrer') return send(REFERRERS);
    return send(COUNTRIES);
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end('{}');
});

if (isMain) server.listen(port, '127.0.0.1', () => process.send?.('ready'));
