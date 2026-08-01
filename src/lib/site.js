// Plain JS so astro.config.mjs and the check scripts can import it without a TS step.

/** Canonical origin. Every other hostname 301s to this one at the edge. */
export const SITE = {
  origin: 'https://malika-bobonazarova.uz',
  name: 'Malika Bobonazarova',
  /** One credential line. Not a qualifications table — see /men-haqimda. */
  credential: 'Davolash ishi bitiruvchisi · oftalmologiya yoʻnalishi',
  description:
    'Malika Bobonazarovaning shaxsiy blogi: kundalik, kitoblar, oʻqish va koʻz sogʻligʻi haqida.',
  locale: 'uz',
};

/**
 * TODO(social): real handles not yet provided.
 *
 * Left genuinely unset rather than filled with a plausible guess. A wrong
 * `sameAs` is worse than none — it can associate her with a stranger's account,
 * and search engines treat it as an identity claim.
 *
 * Everything that consumes these hides itself when they are undefined: the
 * Telegram CTA, the footer social link, the contact line on /maxfiylik, and the
 * `sameAs` array in Person JSON-LD (omitted entirely, never emitted empty).
 * The site is deployable as-is.
 */
export const SOCIAL = {
  /** @type {string | undefined} */
  telegram: undefined,
  /** @type {string | undefined} */
  instagram: undefined,
};

/** Only the handles that are actually configured, in a stable order. */
export const socialUrls = () => [SOCIAL.telegram, SOCIAL.instagram].filter(Boolean);

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

  /**
   * TODO(cms): path to the CMS, once one is installed (e.g. '/keystatic').
   *
   * Left unset rather than pointed at a route that does not exist — a dead link
   * in the admin bar is worse than no link. Setting this makes the CMS appear in
   * the admin bar, giving one-click navigation in both directions.
   */
  /** @type {string | undefined} */
  cmsPath: undefined,
};
