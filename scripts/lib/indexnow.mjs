/**
 * IndexNow — tell Bing and Yandex which URLs changed, on each deploy.
 *
 * A good fit for a static build: no crawl budget to wait on, one POST per
 * deploy. Google ignores IndexNow entirely; it is reached through Search Console
 * and the sitemap, both already in place.
 *
 * Two rules:
 *   - failure is ALWAYS a warning, never a build error. A search engine being
 *     unreachable must not stop a deploy.
 *   - a noindexed preview is never submitted. Asking Bing to index a staging
 *     copy under someone else's hostname is worse than not submitting at all.
 */
import { writeFile } from 'node:fs/promises';
import { globSync } from 'glob';

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

const env = (key) => process.env[key];

/**
 * @returns {{ ok: true, key: string, host: string, origin: string } | { ok: false, reason: string }}
 */
export function indexNowConfig({ origin, noindex } = {}) {
  const key = env('INDEXNOW_KEY');
  if (!key) return { ok: false, reason: 'INDEXNOW_KEY is not set' };
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    return { ok: false, reason: 'INDEXNOW_KEY must be 8-128 chars, letters/digits/dashes only' };
  }
  if (noindex) return { ok: false, reason: 'this deploy is noindexed — not submitting' };
  if (!origin || !/^https?:\/\//.test(origin)) return { ok: false, reason: 'no usable site origin' };

  return { ok: true, key, host: new URL(origin).host, origin };
}

/** The key file IndexNow fetches to prove we own the host: /<key>.txt containing <key>. */
export async function writeKeyFile(dir, key) {
  const path = `${dir}/${key}.txt`;
  await writeFile(path, key, 'utf8');
  return path;
}

/** Every prerendered page, as absolute URLs. */
export function collectUrls(distDir, origin) {
  return globSync(`${distDir}/**/*.html`)
    .map((file) => file.slice(distDir.length).replace(/\/index\.html$/, '').replace(/\.html$/, ''))
    .filter((path) => !path.startsWith('/admin') && !path.startsWith('/keystatic'))
    .map((path) => new URL(path || '/', origin).href)
    .sort();
}

/**
 * Submits and never throws.
 * @returns {Promise<{ submitted: number, status?: number, error?: string }>}
 */
export async function submitUrls({ key, host, origin, urls, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: new URL(`/${key}.txt`, origin).href,
        urlList: urls,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return { submitted: urls.length, status: response.status };
  } catch (error) {
    return { submitted: 0, error: error.message };
  }
}
