#!/usr/bin/env node
/**
 * Two schemas now describe the same content: the Zod schema in
 * src/content.config.ts (what the build accepts) and the Keystatic config (what
 * the admin writes). If they drift, Malika saves a post that fails the build —
 * she never sees the error and the site silently stops updating.
 *
 * This is an explicit test, not a generator. EXPECTED below is the canonical
 * list; both files are compared against it. Adding a field to one file only
 * therefore fails, and so does adding it to both but forgetting this list —
 * which is the point: a schema change should be a deliberate, reviewed edit.
 *
 * Both files are parsed statically. Neither can simply be imported: the Zod one
 * needs Astro's `astro:content` virtual module, and importing the Keystatic one
 * would drag in the whole editor bundle.
 */
import { readFileSync } from 'node:fs';

/** Canonical frontmatter field names. `content` (the body) is not frontmatter. */
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
  ],
  book: ['title', 'author', 'startedOn', 'progress', 'note', 'cover', 'coverAlt'],
};

/** Body fields, which exist in Keystatic but never as frontmatter. */
const BODY_FIELDS = new Set(['content']);

/**
 * Returns the source text of the balanced {...} block that starts at the first
 * `{` at or after `from`.
 */
function block(source, from) {
  const start = source.indexOf('{', from);
  if (start === -1) return '';
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return '';
}

/**
 * Top-level field names of a block, ignoring nested objects and comments.
 * Handles both `key: value` and ES shorthand (`pillar,`), which the Zod schema
 * uses wherever the field name matches an existing const.
 */
function keysOf(blockSource) {
  const stripped = blockSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

  const keys = [];
  let depth = 0;
  let line = '';
  for (const char of stripped) {
    if (char === '\n') {
      const match =
        /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(line) ?? /^\s*([A-Za-z_$][\w$]*)\s*,\s*$/.exec(line);
      if (depth === 0 && match) keys.push(match[1]);
      line = '';
      continue;
    }
    if (depth === 0) {
      const match = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(line + char);
      if (match && (char === '(' || char === '{' || char === '[')) {
        keys.push(match[1]);
        line = '';
        depth += 1;
        continue;
      }
    }
    if ('{[('.includes(char)) depth += 1;
    else if ('}])'.includes(char)) depth -= 1;
    line += char;
  }
  const tail =
    /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(line) ?? /^\s*([A-Za-z_$][\w$]*)\s*,?\s*$/.exec(line);
  if (depth === 0 && tail) keys.push(tail[1]);

  return [...new Set(keys)];
}

const keystatic = readFileSync('keystatic.config.ts', 'utf8');
const zod = readFileSync('src/content.config.ts', 'utf8');

const parsed = {
  keystatic: {
    entry: keysOf(block(keystatic, keystatic.indexOf('const entryFields ='))),
    source: keysOf(block(keystatic, keystatic.indexOf('const sourceFields = fields.object('))),
    singletons: [
      ...new Set(
        ['hozir:', 'oqiyapman:', 'men_haqimda:', 'maxfiylik:', 'sozlamalar:'].flatMap((name) => {
          const at = keystatic.indexOf(name, keystatic.indexOf('singletons:'));
          return keysOf(block(keystatic, keystatic.indexOf('schema:', at)));
        }),
      ),
    ],
    book: keysOf(block(keystatic, keystatic.indexOf('book: fields.object('))),
  },
  zod: {
    entry: [
      ...keysOf(block(zod, zod.indexOf('const entryFields ='))),
      // evergreen is added per-collection, outside the shared field set
      ...(zod.includes('evergreen: z.boolean()') ? ['evergreen'] : []),
    ],
    source: keysOf(block(zod, zod.indexOf('const source = z.object('))),
    singletons: keysOf(block(zod, zod.indexOf('z.object({', zod.indexOf('const site =')))),
    book: keysOf(block(zod, zod.indexOf('book: blankToUndefined('))),
  },
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

for (const group of ['entry', 'source', 'singletons', 'book']) {
  compare(`keystatic.config.ts  ${group}`, EXPECTED[group], parsed.keystatic[group], {
    ignore: BODY_FIELDS,
  });
  compare(`content.config.ts    ${group}`, EXPECTED[group], parsed.zod[group]);
}

if (failures > 0) {
  console.error(
    `\ncheck-schema-sync: ${failures} mismatch(es).` +
      '\n  A field must exist in keystatic.config.ts, src/content.config.ts AND the' +
      '\n  EXPECTED list in this script. Otherwise the admin can save content the' +
      '\n  build rejects.',
  );
  process.exit(1);
}
console.log('\ncheck-schema-sync: both schemas agree.');
