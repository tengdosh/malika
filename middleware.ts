/**
 * Vercel Edge Middleware — HTTP basic auth for /admin/*.
 *
 * This is PLATFORM middleware, not Astro middleware. Astro middleware would need
 * an SSR adapter, and the build is deliberately adapter-free and portable. This
 * file runs on Vercel before any static file is served; Cloudflare Pages has the
 * equivalent in functions/admin/_middleware.js. Neither affects `pnpm build`.
 *
 * Fails CLOSED: if ADMIN_USER / ADMIN_PASSWORD are not set, the route is denied
 * rather than opened. An admin page that becomes public when an env var is
 * missing is worse than one that is briefly unreachable.
 *
 * Set both in the host's environment settings. See docs/malika-uchun.md.
 */
export const config = { matcher: '/admin/:path*' };

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

export default function middleware(request: Request): Response | undefined {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  if (!user || !password) {
    return new Response('Boshqaruv sozlanmagan.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const header = request.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');
  if (scheme?.toLowerCase() !== 'basic' || !encoded) return UNAUTHORISED('Kirish talab qilinadi.');

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return UNAUTHORISED('Kirish talab qilinadi.');
  }

  const separator = decoded.indexOf(':');
  const givenUser = decoded.slice(0, separator);
  const givenPassword = decoded.slice(separator + 1);

  // Both compared unconditionally — no early return on a wrong username.
  const ok = safeEqual(givenUser, user) && safeEqual(givenPassword, password);
  if (!ok) return UNAUTHORISED('Login yoki parol notoʻgʻri.');

  return undefined; // authorised — fall through to the static file
}
