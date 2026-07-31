/**
 * Pillar slugs are ASCII (URL- and filename-safe). Their labels are Uzbek and
 * use U+02BB (ʻ) in Oʻ / Gʻ — never a straight quote. scripts/check-uzbek.mjs
 * enforces that on every build.
 */
export const PILLARS = [
  'kundalik',
  'kitoblar',
  'oqish-kasb',
  'koz-sogligi',
  'yol',
  'esse',
] as const;

export type Pillar = (typeof PILLARS)[number];

export const PILLAR_LABEL: Record<Pillar, string> = {
  kundalik: 'Kundalik',
  kitoblar: 'Kitoblar',
  'oqish-kasb': 'Oʻqish va kasb',
  'koz-sogligi': 'Koʻz sogʻligʻi',
  yol: 'Yoʻl',
  esse: 'Esse',
};

/** Used on the pillar index pages as a one-line standfirst. */
export const PILLAR_BLURB: Record<Pillar, string> = {
  kundalik: 'Kunlarim, kayfiyatim va kichik odatlarim haqida.',
  kitoblar: 'Oʻqiyotgan kitoblarim va ular menda qoldirgan iz.',
  'oqish-kasb': 'Talabalik, ordinaturaga tayyorgarlik va oʻrganish jarayoni.',
  'koz-sogligi': 'Koʻz haqida oddiy tilda — tashxis emas, umumiy maʼlumot.',
  yol: 'Kasb tanlash va yoʻldagi burilish nuqtalari.',
  esse: 'Uzunroq oʻylar.',
};

export const isPillar = (value: string): value is Pillar =>
  (PILLARS as readonly string[]).includes(value);
