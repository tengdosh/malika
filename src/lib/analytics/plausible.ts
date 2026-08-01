/**
 * Plausible Stats API adapter.
 *
 * Kept so switching provider is an environment change rather than a code change,
 * but NOT the default: Plausible Cloud gates the Stats API behind plan tier, and
 * paying for it is not warranted by requirements this modest. If the plan in use
 * does include API access, set ANALYTICS_PROVIDER=plausible.
 */
import {
  type AnalyticsSnapshot,
  type NamedCount,
  type PageCount,
  type Totals,
  EMPTY_TOTALS,
  num,
  safeJson,
} from './types';
import { normalisePath } from './umami';

interface PlausibleConfig {
  apiUrl: string;
  siteId: string;
  apiKey: string;
}

const METRICS = 'visits,visitors,pageviews';

async function aggregate(config: PlausibleConfig, period: string): Promise<Totals> {
  const url =
    `${config.apiUrl}/api/v1/stats/aggregate` +
    `?site_id=${encodeURIComponent(config.siteId)}&period=${period}&metrics=${METRICS}`;
  const body = (await safeJson(url, {
    headers: { authorization: `Bearer ${config.apiKey}` },
  })) as { results?: Record<string, { value?: number }> } | null;

  if (!body?.results) return EMPTY_TOTALS;
  return {
    visits: num(body.results.visits?.value),
    visitors: num(body.results.visitors?.value),
    pageviews: num(body.results.pageviews?.value),
  };
}

async function breakdown(
  config: PlausibleConfig,
  property: string,
  period: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const url =
    `${config.apiUrl}/api/v1/stats/breakdown` +
    `?site_id=${encodeURIComponent(config.siteId)}&period=${period}` +
    `&property=${property}&metrics=visitors,pageviews&limit=${limit}`;
  const body = (await safeJson(url, {
    headers: { authorization: `Bearer ${config.apiKey}` },
  })) as { results?: Record<string, unknown>[] } | null;
  return body?.results ?? [];
}

export async function fetchPlausible(config: PlausibleConfig): Promise<AnalyticsSnapshot | null> {
  const [d7, d30, all] = await Promise.all([
    aggregate(config, '7d'),
    aggregate(config, '30d'),
    // Plausible has no "all" period; 12mo is its longest standard window.
    aggregate(config, '12mo'),
  ]);

  const [pageRows, referrerRows, countryRows] = await Promise.all([
    breakdown(config, 'event:page', '12mo', 200),
    breakdown(config, 'visit:source', '30d', 10),
    breakdown(config, 'visit:country', '30d', 10),
  ]);

  if (all.pageviews === 0 && pageRows.length === 0) {
    console.warn('[analytics] plausible returned no data');
    return null;
  }

  const pages: PageCount[] = pageRows.map((row) => ({
    path: normalisePath(String(row.page ?? '')),
    pageviews: num(row.pageviews),
    visitors: num(row.visitors),
  }));

  const toNamed = (rows: Record<string, unknown>[], key: string): NamedCount[] =>
    rows.map((row) => ({
      name: String(row[key] ?? '') || 'Toʻgʻridan-toʻgʻri',
      visitors: num(row.visitors),
    }));

  return {
    provider: 'plausible',
    fetchedAt: new Date().toISOString(),
    periods: { d7, d30, all },
    pages,
    referrers: toNamed(referrerRows, 'source'),
    places: toNamed(countryRows, 'country'),
    placesLabel: 'Davlatlar',
  };
}
