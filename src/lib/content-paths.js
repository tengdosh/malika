// Plain JS, no imports: keystatic.config.ts is bundled for the browser as well as
// the server, and the Node check scripts import this file directly. Anything
// requiring a TS step or a node: builtin cannot live here.

/**
 * Where each collection and singleton stores its entries.
 *
 * This is the single source of truth for content locations. keystatic.config.ts
 * reads both its `path` and its image `publicPath` from here, so the two can
 * never drift — which is exactly how they drifted before: `publicPath` was one
 * shared constant while the collections sat at two different depths.
 */
// Frozen so the values keep their literal types: Keystatic's `path` is typed as
// `${string}/*`, which a widened `string` does not satisfy.
export const CONTENT_PATHS = Object.freeze({
  posts: 'src/content/posts/*',
  // One level deeper than the other two. This is the whole reason publicPath
  // must be derived rather than shared.
  sogliq: 'src/content/posts/sogliq/*',
  notes: 'src/content/notes/*',

  hozir: 'src/content/site/hozir',
  oqiyapman: 'src/content/site/oqiyapman',
  men_haqimda: 'src/content/site/men_haqimda',
  maxfiylik: 'src/content/site/maxfiylik',
  sozlamalar: 'src/content/site/sozlamalar',
});

/** `src/content/posts/*` -> `src/content/posts`; a singleton path is already a dir. */
const contentDir = (contentPath) => contentPath.replace(/\/\*+$/, '');

/**
 * Keystatic writes an uploaded image's path into the entry as
 * `publicPath + filename`, and Astro resolves that **relative to the content
 * file**. So the number of `../` is a property of where the entry lives, not of
 * where the assets live — and every collection needs its own.
 *
 *   src/content/posts/<slug>.md         -> ../../assets/posts/
 *   src/content/posts/sogliq/<slug>.md  -> ../../../assets/posts/
 *   src/content/site/men_haqimda/index.md -> ../../../assets/about/
 *
 * Get this wrong and astro:assets cannot resolve the image: the build fails the
 * moment a cover is uploaded, long after the config was last looked at.
 *
 * @param {string} contentPath  a value from CONTENT_PATHS
 * @param {string} assetDir     directory under src/assets/
 * @returns {{ directory: string, publicPath: string }} spread into fields.image()
 */
export function assetPath(contentPath, assetDir) {
  const directory = `src/assets/${assetDir}`;

  const from = contentDir(contentPath).split('/').filter(Boolean);
  const to = directory.split('/').filter(Boolean);

  // Drop the shared prefix, climb out of what remains, then descend.
  let shared = 0;
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) {
    shared += 1;
  }

  const up = '../'.repeat(from.length - shared);
  const down = to.slice(shared).join('/');

  return { directory, publicPath: `${up}${down}/` };
}
