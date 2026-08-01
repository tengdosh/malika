import { getEntry } from 'astro:content';

export interface SiteSettings {
  /** Show "N marta oʻqildi" on posts at all. */
  hisoblagichKorsatilsin: boolean;
  /** Posts below this count show no counter. */
  hisoblagichMinimum: number;
}

const FALLBACK: SiteSettings = { hisoblagichKorsatilsin: true, hisoblagichMinimum: 0 };

/**
 * Reads src/content/site/sozlamalar.md. Falls back to defaults if the file is
 * missing so a deleted singleton cannot break the build.
 */
export async function getSettings(): Promise<SiteSettings> {
  const entry = await getEntry('site', 'sozlamalar');
  if (!entry) return FALLBACK;
  return {
    hisoblagichKorsatilsin: entry.data.hisoblagichKorsatilsin,
    hisoblagichMinimum: entry.data.hisoblagichMinimum,
  };
}

/**
 * The count to render for a post, or null for "render nothing".
 * Null covers: counters switched off, analytics unavailable, and below-minimum.
 */
export function counterFor(
  views: number | undefined,
  settings: SiteSettings,
): number | null {
  if (!settings.hisoblagichKorsatilsin) return null;
  if (views === undefined || views <= 0) return null;
  if (views < settings.hisoblagichMinimum) return null;
  return views;
}
