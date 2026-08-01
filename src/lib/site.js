// Plain JS so astro.config.mjs and the check scripts can import it without a TS step.

/**
 * Base path the site is served under: '/' normally, '/malika/' on a subpath
 * deployment. Astro rewrites its OWN asset URLs for `base`, but not paths
 * written by hand in href/src — every one of those goes through withBase().
 *
 * Guarded: astro.config.mjs imports this file, and import.meta.env is not
 * populated in that context.
 */
const BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';

/** withBase('/yozuvlar') -> '/malika/yozuvlar', or '/yozuvlar' with no base. */
export function withBase(path = '/') {
  const prefix = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const suffix = String(path).startsWith('/') ? path : `/${path}`;
  return `${prefix}${suffix}` || '/';
}

/** Strips the base off a request path so route comparisons still work. */
export function stripBase(pathname) {
  const prefix = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  if (prefix && pathname.startsWith(prefix)) return pathname.slice(prefix.length) || '/';
  return pathname;
}

/** Canonical origin. Every other hostname 301s to this one at the edge. */
export const SITE = {
  origin: 'https://malika-bobonazarova.uz',
  name: 'Malika Bobonazarova',
  description:
    'Malika Bobonazarovaning shaxsiy blogi: kundalik, kitoblar, oʻqish va koʻz sogʻligʻi haqida.',
  locale: 'uz',
};


/** Public pages axe + Lighthouse run against in CI. */
export const AUDIT_ROUTES = ['/', '/yozuvlar/navbatchilikdan-keyin', '/men-haqimda'];

/**
 * Additionally audited for accessibility but not for performance: the admin area
 * is behind auth and its load time is irrelevant, but Malika uses it and a data
 * table is easy to get wrong.
 */
export const A11Y_ONLY_ROUTES = ['/admin/statistika'];

/**
 * Admin area. Protected by HTTP basic auth in src/middleware.ts — Astro
 * middleware, so it runs inside the app on any host and is covered by
 * scripts/check-middleware.mjs. Also noindex, excluded from the sitemap, and
 * Disallowed in robots.txt.
 */
export const ADMIN = {
  statsPath: '/admin/statistika',

  /** Keystatic. Rendered in the admin bar, so navigation works both ways. */
  cmsPath: '/keystatic',
};
