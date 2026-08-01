/**
 * Build-time analytics access.
 *
 * Everything here runs on the build machine and never reaches the browser: the
 * API key lives in a non-PUBLIC_ environment variable, the numbers are baked
 * into the static HTML, and no analytics request is made at page load. That
 * keeps the zero-client-JS budget intact and keeps visitors off a third party.
 *
 * The whole module is failure-tolerant by design. If the API is unreachable,
 * slow, misconfigured or empty, every entry point resolves to "no data" and the
 * build succeeds. A stats outage must never block a deploy.
 */
import type { AnalyticsSnapshot } from './types.ts';
import { fetchUmami } from './umami.ts';
import { fetchPlausible } from './plausible.ts';

export type { AnalyticsSnapshot, NamedCount, PageCount, Totals } from './types.ts';

/** import.meta.env carries .env values; process.env carries host-configured ones. */
const env = (key: string): string | undefined => {
  const fromMeta = (import.meta.env as Record<string, string | undefined> | undefined)?.[key];
  return fromMeta ?? process.env[key];
};

/**
 * Memoised for the whole build: one API call serves the stats page and every
 * post counter, however many posts there are.
 */
let snapshotPromise: Promise<AnalyticsSnapshot | null> | undefined;

async function load(): Promise<AnalyticsSnapshot | null> {
  const provider = (env('ANALYTICS_PROVIDER') ?? '').toLowerCase();

  if (provider === 'umami') {
    const apiUrl = env('UMAMI_API_URL');
    const websiteId = env('UMAMI_WEBSITE_ID');
    if (!apiUrl || !websiteId) {
      console.warn('[analytics] umami selected but UMAMI_API_URL / UMAMI_WEBSITE_ID are unset');
      return null;
    }
    return fetchUmami({
      apiUrl: apiUrl.replace(/\/+$/, ''),
      websiteId,
      apiKey: env('UMAMI_API_KEY'),
      username: env('UMAMI_USERNAME'),
      password: env('UMAMI_PASSWORD'),
    });
  }

  if (provider === 'plausible') {
    const apiKey = env('PLAUSIBLE_API_KEY');
    const siteId = env('PLAUSIBLE_SITE_ID');
    if (!apiKey || !siteId) {
      console.warn('[analytics] plausible selected but PLAUSIBLE_API_KEY / PLAUSIBLE_SITE_ID are unset');
      return null;
    }
    return fetchPlausible({
      apiUrl: (env('PLAUSIBLE_API_URL') ?? 'https://plausible.io').replace(/\/+$/, ''),
      siteId,
      apiKey,
    });
  }

  if (provider) console.warn(`[analytics] unknown ANALYTICS_PROVIDER "${provider}"`);
  return null;
}

export function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot | null> {
  snapshotPromise ??= load().catch((error) => {
    console.warn(`[analytics] snapshot failed: ${(error as Error).message}`);
    return null;
  });
  return snapshotPromise;
}

/**
 * path -> all-time pageviews. Empty when analytics is unconfigured or down,
 * which renders no counters rather than zeroes.
 */
export async function getViewCounts(): Promise<Map<string, number>> {
  const snapshot = await getAnalyticsSnapshot();
  const counts = new Map<string, number>();
  for (const page of snapshot?.pages ?? []) {
    counts.set(page.path, (counts.get(page.path) ?? 0) + page.pageviews);
  }
  return counts;
}

/** True when a provider is configured at all — used to explain an empty stats page. */
export const analyticsConfigured = (): boolean => Boolean(env('ANALYTICS_PROVIDER'));
