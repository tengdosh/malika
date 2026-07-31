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
  telegram: 'https://t.me/malikabobonazarova',
  instagram: 'https://instagram.com/malikabobonazarova',
};

/** Pages axe + Lighthouse run against in CI. */
export const AUDIT_ROUTES = ['/', '/yozuvlar/navbatchilikdan-keyin', '/men-haqimda'];
