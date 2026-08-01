#!/usr/bin/env node
/**
 * Three clients now describe the same content: the Zod schema in
 * src/content.config.ts (what the build accepts), the Keystatic config (what the
 * admin writes) and bot/ (what Telegram writes). If they drift, Malika saves a
 * post that fails the build — she never sees the error and the site silently
 * stops updating.
 *
 * This is an explicit test, not a generator. EXPECTED below is the canonical
 * list; every source is compared against it. Adding a field to one file only
 * therefore fails, and so does adding it to both but forgetting this list —
 * which is the point: a schema change should be a deliberate, reviewed edit.
 *
 * The parsing lives in scripts/lib/content-fields.mjs, which the bot imports
 * too: the bot derives its field knowledge rather than restating it, and the
 * structural guard at the bottom fails if that ever stops being true.
 */
import { existsSync, readFileSync } from 'node:fs';
import { botFields, keystaticFields, zodFields } from './lib/content-fields.mjs';

/**
 * Canonical frontmatter field names. `content` (the body) is not frontmatter.
 *
 * `health` is the sogliq collection: same shape minus `pillar`, which is implied
 * by the collection rather than written to the file.
 */
const EXPECTED = {
  entry: [
    'title',
    'description',
    'pillar',
    'date',
    'updated',
    'draft',
    'featured',
    'evergreen',
    'cover',
    'coverAlt',
    'sources',
    'reviewedBy',
    'altQueries',
  ],
  health: [
    'title',
    'description',
    'date',
    'updated',
    'draft',
    'featured',
    'evergreen',
    'cover',
    'coverAlt',
    'sources',
    'reviewedBy',
    'altQueries',
  ],
  source: ['title', 'publisher', 'year', 'url'],
  singletons: [
    'title',
    'description',
    'updated',
    'strip',
    'book',
    'portrait',
    'portraitAlt',
    'muassasa',
    'bitirganYil',
    'telegram',
    'instagram',
    'email',
    'footerBio',
    'hisoblagichKorsatilsin',
    'hisoblagichMinimum',
    'googleSiteVerification',
    'yandexVerification',
    'bingVerification',
  ],
  book: ['title', 'author', 'startedOn', 'progress', 'note', 'cover', 'coverAlt'],
};

/** Body fields, which exist in Keystatic but never as frontmatter. */
const BODY_FIELDS = new Set(['content']);

const keystaticSource = readFileSync('keystatic.config.ts', 'utf8');

const parsed = {
  keystatic: keystaticFields(),
  zod: zodFields(),
  bot: botFields(),
};

let failures = 0;

const compare = (label, expected, actual, { ignore = new Set() } = {}) => {
  const got = actual.filter((field) => !ignore.has(field));
  const missing = expected.filter((field) => !got.includes(field));
  const extra = got.filter((field) => !expected.includes(field));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`  ok   ${label} (${got.length} fields)`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${label}`);
  if (missing.length) console.error(`       missing: ${missing.join(', ')}`);
  if (extra.length) console.error(`       unexpected: ${extra.join(', ')}`);
};

for (const group of ['entry', 'health', 'source', 'singletons', 'book']) {
  compare(`keystatic.config.ts  ${group}`, EXPECTED[group], parsed.keystatic[group], {
    ignore: BODY_FIELDS,
  });
  compare(`content.config.ts    ${group}`, EXPECTED[group], parsed.zod[group]);
}

/* The bot writes entries only — it has no singleton schema of its own, because
   /hozir and /kitob update named fields of files that already exist. */
for (const group of ['entry', 'health', 'source']) {
  compare(`bot/                 ${group}`, EXPECTED[group], parsed.bot[group]);
}

/*
 * Structural guarantees, not field lists:
 *   - the admin must never offer koz-sogligi as a pillar, or an unsourced health
 *     post becomes savable and the Zod backstop becomes reachable again
 *   - the health collection must actually require a source
 */
if (/value:\s*'koz-sogligi'/.test(keystaticSource)) {
  console.error("  FAIL keystatic.config.ts still offers 'koz-sogligi' as a pillar option");
  console.error('       Health posts belong to the sogliq collection, where sources are required.');
  failures += 1;
} else {
  console.log("  ok   keystatic.config.ts  no selectable 'koz-sogligi' pillar");
}

if (/validation:\s*\{\s*length:\s*\{\s*min:\s*1/.test(keystaticSource)) {
  console.log('  ok   keystatic.config.ts  health sources require at least one entry');
} else {
  console.error('  FAIL keystatic.config.ts  health sources are no longer required (length.min 1)');
  failures += 1;
}

/*
 * Image paths must be derived from the collection path, never written by hand.
 *
 * Keystatic resolves an uploaded image relative to the entry file, and the entry
 * collections do not share a depth: sogliq lives at src/content/posts/sogliq/*,
 * one level below posts and notes. A single shared `publicPath` literal is
 * therefore wrong for one of them, and wrong in the worst way — the config looks
 * fine, every existing post builds, and the failure only appears the first time
 * a cover is uploaded to a health post. src/lib/content-paths.js computes it.
 */
const hardcoded = [...keystaticSource.matchAll(/^.*\bpublicPath\s*:.*$/gm)].map((m) => m[0].trim());
if (hardcoded.length === 0) {
  console.log('  ok   keystatic.config.ts  image paths derived from the collection path');
} else {
  console.error('  FAIL keystatic.config.ts hardcodes publicPath — derive it instead');
  console.error('       use assetPath(CONTENT_PATHS.<name>, <assetDir>) from src/lib/content-paths.js');
  for (const line of hardcoded) console.error(`       ${line}`);
  failures += 1;
}

/*
 * The bot must derive its fields and its cover depth, never restate them. This
 * is the guard that stops "three schemas" from becoming true: hand-typed lists
 * can agree today and drift tomorrow, and the drift is invisible until a save
 * fails the build.
 */
const BOT_ENTRY = 'bot/src/entry.mjs';
if (existsSync(BOT_ENTRY)) {
  const bot = readFileSync(BOT_ENTRY, 'utf8');
  const derivesFields = /scripts\/lib\/content-fields\.mjs/.test(bot);
  const derivesPaths = /src\/lib\/content-paths\.js/.test(bot);

  if (derivesFields && derivesPaths) {
    console.log('  ok   bot/                 fields and cover depth derived, not restated');
  } else {
    console.error('  FAIL bot/src/entry.mjs no longer derives the schema');
    if (!derivesFields) console.error('       expected an import of scripts/lib/content-fields.mjs');
    if (!derivesPaths) console.error('       expected an import of src/lib/content-paths.js');
    failures += 1;
  }
} else {
  // The bot is optional; the rule is that it derives the schema *if it exists*.
  // Failing on its absence would make this check describe a wish rather than the
  // repository.
  console.log('  --   bot/                 not present, nothing to check');
}

if (failures > 0) {
  console.error(
    `\ncheck-schema-sync: ${failures} mismatch(es).` +
      '\n  A field must exist in keystatic.config.ts, src/content.config.ts, bot/ AND' +
      '\n  the EXPECTED list in this script. Otherwise a client can save content the' +
      '\n  build rejects.',
  );
  process.exit(1);
}
console.log('\ncheck-schema-sync: all three schemas agree.');
