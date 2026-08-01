/**
 * Cloudflare Pages Functions — HTTP basic auth for /admin/*.
 *
 * The Cloudflare equivalent of the root middleware.ts used on Vercel. Only one
 * of the two runs, depending on where the site is deployed; both are kept so the
 * build stays portable between hosts.
 *
 * Fails CLOSED when ADMIN_USER / ADMIN_PASSWORD are unset.
 * Set them under Pages → Settings → Environment variables.
 */

const UNAUTHORISED = (message) =>
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
function safeEqual(a, b) {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export const onRequest = async (context) => {
  const { request, env, next } = context;
  const user = env.ADMIN_USER;
  const password = env.ADMIN_PASSWORD;

  if (!user || !password) {
    return new Response('Boshqaruv sozlanmagan.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const header = request.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'basic' || !encoded) {
    return UNAUTHORISED('Kirish talab qilinadi.');
  }

  let decoded;
  try {
    decoded = atob(encoded);
  } catch {
    return UNAUTHORISED('Kirish talab qilinadi.');
  }

  const separator = decoded.indexOf(':');
  const ok =
    safeEqual(decoded.slice(0, separator), user) &&
    safeEqual(decoded.slice(separator + 1), password);

  if (!ok) return UNAUTHORISED('Login yoki parol notoʻgʻri.');

  return next();
};
