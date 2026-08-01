/**
 * Self-hosted Umami (v2) adapter.
 *
 * Chosen as the default provider: the analytics requirements here are modest,
 * Umami's API is fully available at no cost, and the data stays on
 * infrastructure we control. Plausible Cloud gates its Stats API behind plan
 * tier, so it is supported but not assumed — see plausible.ts.
 *
 * Auth: an API key (Umami Cloud) via x-umami-api-key, or a username/password
 * login (self-hosted) exchanged for a bearer token.
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

interface UmamiConfig {
  apiUrl: string;
  websiteId: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

const DAY = 86_400_000;

async function authHeaders(config: UmamiConfig): Promise<Record<string, string> | null> {
  if (config.apiKey) return { 'x-umami-api-key': config.apiKey };

  if (config.username && config.password) {
    const body = await safeJson(`${config.apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: config.username, password: config.password }),
    });
    const token = (body as { token?: string } | null)?.token;
    if (token) return { authorization: `Bearer ${token}` };
  }

  console.warn('[analytics] umami: no usable credentials');
  return null;
}

async function totals(
  config: UmamiConfig,
  headers: Record<string, string>,
  startAt: number,
  endAt: number,
): Promise<Totals> {
  const url = `${config.apiUrl}/api/websites/${config.websiteId}/stats?startAt=${startAt}&endAt=${endAt}`;
  const body = (await safeJson(url, { headers })) as Record<string, { value?: number }> | null;
  if (!body) return EMPTY_TOTALS;

  return {
    visits: num(body.visits?.value),
    visitors: num(body.visitors?.value),
    pageviews: num(body.pageviews?.value),
  };
}

async function metrics(
  config: UmamiConfig,
  headers: Record<string, string>,
  type: 'url' | 'referrer' | 'country' | 'city',
  startAt: number,
  endAt: number,
  limit = 20,
): Promise<{ x: string; y: number }[]> {
  const url =
    `${config.apiUrl}/api/websites/${config.websiteId}/metrics` +
    `?startAt=${startAt}&endAt=${endAt}&type=${type}&limit=${limit}`;
  const body = await safeJson(url, { headers });
  return Array.isArray(body) ? (body as { x: string; y: number }[]) : [];
}

export async function fetchUmami(config: UmamiConfig): Promise<AnalyticsSnapshot | null> {
  const headers = await authHeaders(config);
  if (!headers) return null;

  const now = Date.now();
  // Umami has no "all time" period; 10 years is comfortably longer than the site
  // will have existed and costs the same single query.
  const allTimeStart = now - 3650 * DAY;

  const [d7, d30, all] = await Promise.all([
    totals(config, headers, now - 7 * DAY, now),
    totals(config, headers, now - 30 * DAY, now),
    totals(config, headers, allTimeStart, now),
  ]);

  // Per-post counts are all-time: a reader wants the total, not a 30-day window.
  const [urls, referrers, places] = await Promise.all([
    metrics(config, headers, 'url', allTimeStart, now, 200),
    metrics(config, headers, 'referrer', now - 30 * DAY, now, 10),
    metrics(config, headers, 'country', now - 30 * DAY, now, 10),
  ]);

  if (all.pageviews === 0 && urls.length === 0) {
    console.warn('[analytics] umami returned no data');
    return null;
  }

  const pages: PageCount[] = urls.map((item) => ({
    path: normalisePath(item.x),
    pageviews: num(item.y),
    visitors: 0, // Umami's url metric reports views only
  }));

  const toNamed = (items: { x: string; y: number }[]): NamedCount[] =>
    items.map((item) => ({ name: item.x || 'Toʻgʻridan-toʻgʻri', visitors: num(item.y) }));

  return {
    provider: 'umami',
    fetchedAt: new Date(now).toISOString(),
    periods: { d7, d30, all },
    pages,
    referrers: toNamed(referrers),
    places: toNamed(places),
    placesLabel: 'Davlatlar',
  };
}

/** Strip query strings and trailing slashes so paths match Astro’s routes. */
export function normalisePath(raw: string): string {
  const path = (raw || '/').split('?')[0]!.split('#')[0]!;
  const trimmed = path.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed || '/' : `/${trimmed}`;
}
