// Plain JS so astro.config.mjs and the check scripts can import it without a TS step.

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
 * Admin area. Protected at the edge by HTTP basic auth (middleware.ts for
 * Vercel, functions/admin/_middleware.js for Cloudflare Pages), noindex,
 * excluded from the sitemap, and Disallowed in robots.txt.
 */
export const ADMIN = {
  statsPath: '/admin/statistika',

  /** Keystatic. Rendered in the admin bar, so navigation works both ways. */
  cmsPath: '/keystatic',
};
