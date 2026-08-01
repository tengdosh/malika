/** Normalised shape both providers are mapped into, so nothing downstream cares which is in use. */

export interface Totals {
  visits: number;
  visitors: number;
  pageviews: number;
}

export interface NamedCount {
  name: string;
  visitors: number;
}

export interface PageCount {
  path: string;
  pageviews: number;
  visitors: number;
}

export interface AnalyticsSnapshot {
  provider: 'umami' | 'plausible';
  fetchedAt: string;
  periods: { d7: Totals; d30: Totals; all: Totals };
  pages: PageCount[];
  referrers: NamedCount[];
  places: NamedCount[];
  /** "Davlatlar" or "Shaharlar" — providers differ in what they expose cheaply. */
  placesLabel: string;
}

export const EMPTY_TOTALS: Totals = { visits: 0, visitors: 0, pageviews: 0 };

/**
 * Every provider call goes through this. A stats outage must never block a
 * deploy — same rule as everything else Malika touches — so failures resolve to
 * null and the caller renders nothing.
 */
export async function safeJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<unknown | null> {
  const { timeoutMs = 8000, ...rest } = init;
  try {
    const response = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      console.warn(`[analytics] ${response.status} ${response.statusText} for ${url}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`[analytics] request failed for ${url}: ${(error as Error).message}`);
    return null;
  }
}

export const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;
