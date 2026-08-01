/**
 * Title -> ASCII slug.
 *
 * The slug becomes a filename and a public URL, so it must be ASCII and it must
 * never come from anything but a transliterated title — a path fragment taken
 * from a message is how a bot with repository write access turns into a way to
 * write anywhere on disk.
 *
 * Matches the slugs already in the repo: "Koʻz oldidagi \"chivinlar\" nima?"
 * becomes `koz-oldidagi-chivinlar`, i.e. the modifier letters are dropped rather
 * than turned into an apostrophe.
 */

/** Uzbek modifier letters and every apostrophe shape: dropped, never replaced. */
const APOSTROPHES = /[ʻʼ’‘'`´]/g;

/** Cyrillic, in case a title is pasted in Russian. */
const CYRILLIC = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // Uzbek Cyrillic extras.
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

const MAX_LENGTH = 80;

/**
 * @param {string} title
 * @returns {string} ASCII slug, or '' if the title transliterates to nothing
 */
export function slugify(title) {
  const lowered = String(title ?? '').toLowerCase();

  const transliterated = [...lowered]
    .map((char) => CYRILLIC[char] ?? char)
    .join('')
    .replace(APOSTROPHES, '')
    // Decompose, then drop combining marks: é -> e.
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, '');
}

/**
 * A slug nobody else is using.
 *
 * Public URLs merge posts, health posts and notes into /yozuvlar/<slug>, so a
 * collision is a collision across all three — scripts/check-slug-collisions.mjs
 * fails the build on one. Suffixes rather than overwrites: the bot must never
 * silently replace an existing entry.
 *
 * @param {string} title
 * @param {(slug: string) => boolean} taken
 * @returns {string}
 */
export function uniqueSlug(title, taken) {
  const base = slugify(title) || 'yozuv';
  if (!taken(base)) return base;

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken(candidate)) return candidate;
  }
  throw new Error(`could not find a free slug for "${title}"`);
}

/**
 * Rejects anything that is not a bare slug. Belt and braces: every path the bot
 * writes is built from slugify() output, and this asserts that upstream of every
 * filesystem call.
 *
 * @param {string} slug
 */
export function assertSafeSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`unsafe slug: ${JSON.stringify(slug)}`);
  }
  return slug;
}
