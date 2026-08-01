/**
 * The content schema, read at runtime from the files that define it.
 *
 * Three clients now describe the same content: the Zod schema in
 * src/content.config.ts (what the build accepts), keystatic.config.ts (what the
 * admin writes) and bot/ (what Telegram writes). Three hand-maintained lists
 * drift, and the failure mode is the worst one this project has: Malika saves
 * something, the build rejects it, and nobody is told.
 *
 * So nobody restates the field list. This module parses it out of the Zod file,
 * and both scripts/check-schema-sync.mjs and the bot import it.
 *
 * **Why parsed rather than executed.** src/content.config.ts imports
 * `astro:content`, a virtual module that only exists inside an Astro build, so
 * `import()` fails outside one. Executing it instead would mean declaring `zod`
 * as a direct dependency and hoping pnpm dedupes it to the exact instance Astro
 * bundles — two Zod instances silently break `.refine()` and schema detection in
 * the build, which is a worse risk than a parser this repo already relied on.
 */
import { readFileSync } from 'node:fs';

/**
 * Source text of the balanced {...} block starting at the first `{` at or after
 * `from`.
 */
export function block(source, from) {
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
export function keysOf(blockSource) {
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

  /*
   * Conditional spreads contribute their keys too. The health collection drops
   * `pillar` with `...(health ? {} : { pillar: ... })`, which the walker above
   * skips because the key sits inside the ternary's object literal — and a field
   * this check cannot see is a field it cannot keep in sync.
   *
   * If the shape of a spread ever changes, this stops matching and the caller
   * reports a MISSING field rather than silently passing. That is the safe
   * direction to fail in.
   */
  for (const spread of stripped.matchAll(/\.\.\.\([\s\S]*?\)\s*,/g)) {
    // Only real field definitions. A spread also carries option objects
    // (`validation: { length: { min: 1 } }`), whose keys are not fields.
    for (const field of spread[0].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:fields|z)\./gm)) {
      keys.push(field[1]);
    }
  }

  return [...new Set(keys)];
}

const read = (path) => readFileSync(path, 'utf8');

/**
 * Field names per group, as defined by the Zod schema.
 *
 * @param {string} [path] src/content.config.ts
 */
export function zodFields(path = 'src/content.config.ts') {
  const zod = read(path);
  const shared = keysOf(block(zod, zod.indexOf('const entryFields =')));
  // evergreen is added per-collection, outside the shared field set.
  const withEvergreen = [...shared, ...(zod.includes('evergreen: z.boolean()') ? ['evergreen'] : [])];

  return {
    entry: withEvergreen,
    // The sogliq collection spreads entryFields and overrides pillar/sources:
    // pillar is implied by the collection and never written to the file.
    health: withEvergreen.filter((field) => field !== 'pillar'),
    source: keysOf(block(zod, zod.indexOf('const source = z.object('))),
    singletons: keysOf(block(zod, zod.indexOf('z.object({', zod.indexOf('const site =')))),
    book: keysOf(block(zod, zod.indexOf('book: blankToUndefined('))),
  };
}

/** Field names per group, as defined by the Keystatic config. */
export function keystaticFields(path = 'keystatic.config.ts') {
  const keystatic = read(path);
  const shared = keysOf(block(keystatic, keystatic.indexOf('const entryFields =')));

  return {
    entry: shared,
    health: shared.filter((field) => field !== 'pillar'),
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
  };
}

/**
 * Fields the bot may write, derived — not restated.
 *
 * `pillar` is dropped for health entries because the sogliq collection implies
 * it; writing it would be a second place the value could be wrong.
 */
export function botFields(path = 'src/content.config.ts') {
  const { entry, health, source } = zodFields(path);
  return { entry, health, source };
}
