import { defineMiddleware } from 'astro:middleware';

import { stripBase } from './lib/site.js';

/**
 * HTTP basic auth for /admin/*.
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

export const onRequest = defineMiddleware(async (context, next) => {
  const path = stripBase(context.url.pathname);
  if (!path.startsWith('/admin')) return next();

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
  return response;
});
