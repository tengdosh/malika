import { SITE } from './site.js';
import type { Entry } from './entries';

/** Stable @id so BlogPosting.author can reference the same Person everywhere. */
export const PERSON_ID = `${SITE.origin}/#malika`;

/** Kept light on purpose — she is a person, not an institution. */
export function personJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: SITE.name,
    url: SITE.origin,
    sameAs: [SITE.telegram, SITE.instagram],
  };
}

export function blogPostingJsonLd(
  entry: Entry,
  url: string,
  imageUrl?: string,
): Record<string, unknown> {
  const { title, description, date, updated } = entry.data;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    inLanguage: 'uz',
    datePublished: date.toISOString(),
    ...(updated && { dateModified: updated.toISOString() }),
    ...(imageUrl && { image: imageUrl }),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@id': PERSON_ID },
    publisher: { '@id': PERSON_ID },
  };
}

/**
 * MedicalWebPage is emitted ONLY on koz-sogligi posts. Google treats health
 * content as YMYL under strict E-E-A-T; claiming it on a diary entry would be
 * both wrong and counterproductive.
 */
export function medicalWebPageJsonLd(entry: Entry, url: string): Record<string, unknown> {
  const { title, description, date, updated, sources } = entry.data;
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    '@id': url,
    name: title,
    description,
    inLanguage: 'uz',
    lastReviewed: (updated ?? date).toISOString(),
    author: { '@id': PERSON_ID },
    citation: sources.map((source) => ({
      '@type': 'CreativeWork',
      name: source.title,
      publisher: { '@type': 'Organization', name: source.publisher },
      ...(source.year && { datePublished: String(source.year) }),
      ...(source.url && { url: source.url }),
    })),
  };
}
