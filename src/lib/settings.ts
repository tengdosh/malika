import { getEntry } from 'astro:content';

/**
 * Everything Malika controls from the admin, in one place.
 *
 * Empty stays a valid state throughout: an unset Telegram handle means the
 * subscribe block does not render and `sameAs` is omitted from Person JSON-LD
 * entirely rather than emitted empty. A wrong or empty sameAs is worse than
 * none — it is an identity claim.
 */
export interface SiteSettings {
  telegram?: string;
  instagram?: string;
  email?: string;
  /** The one-line credential sentence, shown in the footer and every byline. */
  footerBio: string;
  hisoblagichKorsatilsin: boolean;
  hisoblagichMinimum: number;
  /** Search-console fallbacks; DNS TXT is preferable. Rendered only when set. */
  googleSiteVerification?: string;
  yandexVerification?: string;
  bingVerification?: string;
}

const FALLBACK: SiteSettings = {
  footerBio: 'Davolash ishi bitiruvchisi · oftalmologiya yoʻnalishi',
  hisoblagichKorsatilsin: true,
  hisoblagichMinimum: 0,
};

/** Reads sozlamalar. Falls back to defaults so a deleted singleton cannot break the build. */
export async function getSettings(): Promise<SiteSettings> {
  const entry = await getEntry('site', 'sozlamalar');
  if (!entry) return FALLBACK;
  return {
    telegram: entry.data.telegram,
    instagram: entry.data.instagram,
    email: entry.data.email,
    footerBio: entry.data.footerBio ?? FALLBACK.footerBio,
    hisoblagichKorsatilsin: entry.data.hisoblagichKorsatilsin,
    hisoblagichMinimum: entry.data.hisoblagichMinimum,
    googleSiteVerification: entry.data.googleSiteVerification,
    yandexVerification: entry.data.yandexVerification,
    bingVerification: entry.data.bingVerification,
  };
}

/** Only the handles that are actually set, in a stable order. */
export const socialUrls = (settings: SiteSettings): string[] =>
  [settings.telegram, settings.instagram].filter((url): url is string => Boolean(url));

/**
 * The count to render for a post, or null for "render nothing".
 * Null covers: counters switched off, analytics unavailable, and below-minimum.
 */
export function counterFor(views: number | undefined, settings: SiteSettings): number | null {
  if (!settings.hisoblagichKorsatilsin) return null;
  if (views === undefined || views <= 0) return null;
  if (views < settings.hisoblagichMinimum) return null;
  return views;
}
