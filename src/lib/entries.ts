import { getCollection, type CollectionEntry } from 'astro:content';
import { withBase } from './site.js';

/** posts, sogliq and notes share a schema; most components accept any of them. */
export type Entry =
  | CollectionEntry<'posts'>
  | CollectionEntry<'sogliq'>
  | CollectionEntry<'notes'>;

/** Anything that renders under /yozuvlar — ordinary posts and health posts alike. */
export type PostEntry = CollectionEntry<'posts'> | CollectionEntry<'sogliq'>;

/**
 * The URL slug. `sogliq` is an authoring split, not a URL split: a health post
 * lives at /yozuvlar/<slug> exactly like any other, so its collection never
 * appears in the path. scripts/check-slug-collisions.mjs guarantees the two
 * collections cannot claim the same slug.
 */
export const entrySlug = (entry: Entry): string => entry.id;

export const entryHref = (entry: Entry): string =>
  withBase(
    entry.collection === 'notes'
      ? `/qaydlar/${entrySlug(entry)}`
      : `/yozuvlar/${entrySlug(entry)}`,
  );

/** Drafts render in dev so she can preview them, and never ship. */
const isPublished = (entry: { data: { draft: boolean } }) =>
  import.meta.env.PROD ? !entry.data.draft : true;

const newestFirst = (a: Entry, b: Entry) => b.data.date.getTime() - a.data.date.getTime();

/** Notes are sorted by last touched, not first published — they keep changing. */
const lastTouched = (entry: Entry) => (entry.data.updated ?? entry.data.date).getTime();

/**
 * Every entry that renders under /yozuvlar, both collections merged and sorted
 * as one list. Callers do not need to know about the split — which is the point.
 */
export async function getPosts(): Promise<PostEntry[]> {
  const [posts, health] = await Promise.all([
    getCollection('posts', isPublished),
    getCollection('sogliq', isPublished),
  ]);
  return [...posts, ...health].sort(newestFirst);
}

export async function getNotes(): Promise<CollectionEntry<'notes'>[]> {
  const notes = await getCollection('notes', isPublished);
  return notes.sort((a, b) => lastTouched(b) - lastTouched(a));
}

/**
 * The featured slot: an explicitly featured post, else the newest one.
 * Returns the rest separately so the caller never renders a post twice.
 */
export function splitFeatured<T extends Entry>(entries: T[]): { featured?: T; rest: T[] } {
  if (entries.length === 0) return { rest: [] };
  const index = Math.max(
    0,
    entries.findIndex((e) => e.data.featured),
  );
  const featured = entries[index];
  return { featured, rest: entries.filter((_, i) => i !== index) };
}
