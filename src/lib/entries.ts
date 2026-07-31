import { getCollection, type CollectionEntry } from 'astro:content';

/** posts and notes share a schema; most components accept either. */
export type Entry = CollectionEntry<'posts'> | CollectionEntry<'notes'>;

export const entryHref = (entry: Entry): string =>
  entry.collection === 'notes' ? `/qaydlar/${entry.id}` : `/yozuvlar/${entry.id}`;

/** Drafts render in dev so she can preview them, and never ship. */
const isPublished = (entry: { data: { draft: boolean } }) =>
  import.meta.env.PROD ? !entry.data.draft : true;

const newestFirst = (a: Entry, b: Entry) => b.data.date.getTime() - a.data.date.getTime();

/** Notes are sorted by last touched, not first published — they keep changing. */
const lastTouched = (entry: Entry) => (entry.data.updated ?? entry.data.date).getTime();

export async function getPosts(): Promise<CollectionEntry<'posts'>[]> {
  const posts = await getCollection('posts', isPublished);
  return posts.sort(newestFirst);
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
