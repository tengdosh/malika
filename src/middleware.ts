import { defineMiddleware } from 'astro:middleware';

import { stripBase, withBase } from './lib/site.js';

/**
 * HTTP basic auth for the whole management area.
 *
 * Astro middleware, not platform config: it runs as part of the app, so it works
 * on any host and can be covered by a fixture — scripts/check-middleware.mjs
 * boots the built server and asserts the whole matrix. (It replaced per-platform
 * edge middleware that no check could reach; those files are long gone.)
 *
 * IMPORTANT: Astro middleware only runs per request for ON-DEMAND routes. For a
 * prerendered page it runs once at build time, which is useless for auth. That
 * is why src/pages/admin/statistika.astro sets `prerender = false`.
 *
 * Fails CLOSED: with ADMIN_USER / ADMIN_PASSWORD unset the route returns 503
 * rather than becoming public. An admin page that opens up when an env var is
 * missing is worse than one that is briefly unreachable.
 */

const UNAUTHORISED = (message: string) =>
  new Response(message, {
    status: 401,
    headers: {
      'www-authenticate': 'Basic realm="Boshqaruv", charset="UTF-8"',
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });

/** Length-independent compare, so a wrong password cannot be found by timing. */
function safeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Read at request time, so the server picks up its environment without a rebuild. */
const env = (key: string): string | undefined =>
  process.env[key] ?? (import.meta.env as Record<string, string | undefined>)[key];

/**
 * Everything behind the password.
 *
 * `/keystatic` and its API used to be reachable by anyone who knew the address.
 * That was survivable only while the CMS was in GitHub mode and could not
 * authenticate anybody — GitHub was doing the gatekeeping. In `local` storage
 * there is no login at all: whoever opens the page can rewrite the site. So the
 * CMS is protected here, by the same credentials as /admin, and it fails closed
 * the same way.
 *
 * `/cms` is the address Malika is given; it redirects into /keystatic and is
 * listed so the prompt appears before the redirect rather than after it.
 */
const PROTECTED = ['/admin', '/keystatic', '/api/keystatic', '/cms'];

export const onRequest = defineMiddleware(async (context, next) => {
  const path = stripBase(context.url.pathname);
  const guarded = PROTECTED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!guarded) return next();

  const user = env('ADMIN_USER');
  const password = env('ADMIN_PASSWORD');

  if (!user || !password) {
    return new Response('Boshqaruv sozlanmagan.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const header = context.request.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');
  if (scheme?.toLowerCase() !== 'basic' || !encoded) return UNAUTHORISED('Kirish talab qilinadi.');

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return UNAUTHORISED('Kirish talab qilinadi.');
  }

  const separator = decoded.indexOf(':');
  // Both compared unconditionally — no early return on a wrong username.
  const ok =
    safeEqual(decoded.slice(0, separator), user) &&
    safeEqual(decoded.slice(separator + 1), password);

  if (!ok) return UNAUTHORISED('Login yoki parol notoʻgʻri.');

  const response = await next();
  // The admin area is never cached and never indexed, whatever the host does.
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-robots-tag', 'noindex, nofollow');

  return injectInsecureCryptoShim(path, response);
});

/**
 * Keystatic hashes file contents in the browser, and browsers only expose
 * `crypto.subtle` in a secure context. Served over plain HTTP the editor throws
 *
 *     Cannot read properties of undefined (reading 'digest')
 *
 * on the first entry it opens and hangs on a spinner — with the sidebar rendered,
 * which is what makes it look like a slow load rather than a broken one.
 *
 * So a digest-only shim is injected ahead of the editor's own script. It checks
 * for the real implementation first and stands aside when there is one, which
 * means this costs nothing the moment HTTPS is on and can then be deleted.
 *
 * It is a stopgap, not a fix. It does not make the connection private — the
 * password still crosses the network in clear text until 443 reaches this
 * server. See README > Telegram bot / Deployment.
 */
async function injectInsecureCryptoShim(path: string, response: Response): Promise<Response> {
  if (!path.startsWith('/keystatic')) return response;
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;

  const html = await response.text();
  const tag = `<script src="${withBase('/keystatic-insecure-polyfill.js')}"></script>`;
  // The page has no <head>: Astro emits `<!DOCTYPE html><style>…` and goes
  // straight into scripts, so the doctype is the only reliable anchor.
  const patched = /<!doctype html>/i.test(html)
    ? html.replace(/<!doctype html>/i, (match) => `${match}${tag}`)
    : tag + html;

  const headers = new Headers(response.headers);
  // The body changed length, and a stale content-length truncates the page.
  headers.delete('content-length');
  return new Response(patched, { status: response.status, statusText: response.statusText, headers });
}
