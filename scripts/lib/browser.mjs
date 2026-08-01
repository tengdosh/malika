/** Shared helpers for the audit scripts: find a Chrome, serve dist/. */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { extname, join, normalize } from 'node:path';
import { globSync } from 'glob';

/** Locate a Chrome/Chromium without downloading one. */
export function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;

  const candidates = [
    ...globSync(`${process.env.HOME}/.cache/puppeteer/chrome/*/chrome-linux64/chrome`),
    ...globSync(`${process.env.HOME}/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`),
    ...globSync(`${process.env.HOME}/.cache/ms-playwright/chromium-*/chrome-linux/chrome`),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      'No Chrome found. Set CHROME_PATH, or run `npx puppeteer browsers install chrome`.',
    );
  }
  return found;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Where the built public site ends up.
 *
 * @astrojs/node splits the build: prerendered pages and assets go to
 * dist/client, the server bundle to dist/server. Every check serves the same
 * directory the web server would serve.
 */
export function resolveDistDir(root = '.') {
  for (const candidate of ['dist/client', 'dist']) {
    if (existsSync(join(root, candidate, 'index.html'))) return candidate;
  }
  return 'dist';
}

/** Types worth compressing. woff2/avif/webp/jpg/png are already compressed. */
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.xml', '.svg', '.txt']);

/**
 * Static server for dist/, with the trailingSlash:'never' → /index.html mapping.
 *
 * Serves brotli/gzip, because the real server is expected to (see README >
 * Deployment). Measuring Lighthouse against uncompressed HTML inflated FCP by
 * roughly 700ms — an artefact of the harness, not the site.
 */
export function serveDist(root = resolveDistDir(), port = 4321) {
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const base = join(root, normalize(url).replace(/^(\.\.[/\\])+/, ''));

    const candidates = [base, `${base}.html`, join(base, 'index.html')];
    const file = candidates.find((p) => existsSync(p) && statSync(p).isFile());

    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('404');
      return;
    }

    let body = readFileSync(file);
    const headers = {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000',
      vary: 'accept-encoding',
    };

    const accepted = String(req.headers['accept-encoding'] ?? '');
    if (COMPRESSIBLE.has(extname(file))) {
      if (accepted.includes('br')) {
        body = brotliCompressSync(body);
        headers['content-encoding'] = 'br';
      } else if (accepted.includes('gzip')) {
        body = gzipSync(body);
        headers['content-encoding'] = 'gzip';
      }
    }

    headers['content-length'] = String(body.length);
    res.writeHead(200, headers);
    res.end(body);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${port}` }));
  });
}

export const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--hide-scrollbars',
];
