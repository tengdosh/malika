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

/** Pages axe + Lighthouse run against in CI. */
export const AUDIT_ROUTES = ['/', '/yozuvlar/navbatchilikdan-keyin', '/men-haqimda'];
