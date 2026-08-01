#!/usr/bin/env node
/**
 * `posts` and `sogliq` are separate authoring collections that share one URL
 * namespace: both render at /yozuvlar/<slug>. The split exists so the admin can
 * require sources on health posts — it is not meant to be visible in URLs.
 *
 * That makes a slug collision possible in a way it was not before: two files,
 * two collections, one route. Astro would fail with a duplicate-route error that
 * says nothing about the cause, so this check catches it first and names both
 * files.
 *
 * It also guards the notes namespace (/qaydlar/<slug>) for symmetry, and checks
 * that nothing in `posts/` accidentally shadows the `sogliq/` directory name.
 */
import { basename } from 'node:path';
import { globSync } from 'glob';

/** slug = filename without extension, which is exactly what Astro's glob loader uses as the id. */
const slugsIn = (pattern) =>
  globSync(pattern).map((file) => ({ slug: basename(file).replace(/\.mdx?$/, ''), file }));

const NAMESPACES = [
  {
    route: '/yozuvlar/<slug>',
    sources: [
      { collection: 'posts', entries: slugsIn('src/content/posts/*.{md,mdx}') },
      { collection: 'sogliq', entries: slugsIn('src/content/posts/sogliq/*.{md,mdx}') },
    ],
  },
  {
    route: '/qaydlar/<slug>',
    sources: [{ collection: 'notes', entries: slugsIn('src/content/notes/**/*.{md,mdx}') }],
  },
];

let failures = 0;

for (const { route, sources } of NAMESPACES) {
  const seen = new Map(); // slug -> [{collection, file}]
  let total = 0;

  for (const { collection, entries } of sources) {
    for (const { slug, file } of entries) {
      total += 1;
      if (!seen.has(slug)) seen.set(slug, []);
      seen.get(slug).push({ collection, file });
    }
  }

  const collisions = [...seen.entries()].filter(([, hits]) => hits.length > 1);

  if (collisions.length > 0) {
    failures += collisions.length;
    console.error(`  FAIL ${route} — ${collisions.length} slug collision(s)`);
    for (const [slug, hits] of collisions) {
      console.error(`       "${slug}" claimed by:`);
      hits.forEach((hit) => console.error(`         ${hit.collection.padEnd(7)} ${hit.file}`));
    }
  } else {
    console.log(
      `  ok   ${route} — ${total} entries across ` +
        `${sources.map((s) => s.collection).join(' + ')}, no collisions`,
    );
  }
}

// A post literally named "sogliq" would sit at src/content/posts/sogliq.md and
// collide with the health directory in a confusing way.
if (globSync('src/content/posts/sogliq.{md,mdx}').length > 0) {
  console.error('  FAIL src/content/posts/sogliq.md shadows the sogliq/ collection directory');
  failures += 1;
}

if (failures > 0) {
  console.error(
    '\ncheck-slug-collisions: two entries want the same URL.' +
      '\n  Rename one of them — in the admin, that is the "Havoladagi nomi" field.',
  );
  process.exit(1);
}
console.log('\ncheck-slug-collisions: every URL is claimed once.');
