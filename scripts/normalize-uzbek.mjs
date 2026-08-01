#!/usr/bin/env node
/**
 * Uzbek apostrophe normaliser — the CLI.
 *
 * Content is normalised, source code is linted. This half rewrites what Malika
 * typed; scripts/check-uzbek.mjs fails on what a developer typed. See
 * scripts/lib/normalize-uzbek.mjs for the rules and for the module API, which is
 * what other callers should use.
 *
 * Usage:
 *   node scripts/normalize-uzbek.mjs              # rewrite src/content/**
 *   node scripts/normalize-uzbek.mjs --check      # report only, exit 1 if stale
 *   node scripts/normalize-uzbek.mjs <glob> ...   # explicit paths (fixtures)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'glob';
import { normalizeUzbek } from './lib/normalize-uzbek.mjs';

const DEFAULT_PATTERNS = [
  'src/content/**/*.{md,mdx,yaml,yml}',
  // Uzbek prose written for Malika, not source code — same rule as content.
  'docs/**/*.md',
];

const args = process.argv.slice(2);
const check = args.includes('--check');
const patterns = args.filter((arg) => !arg.startsWith('--'));

const files = globSync(patterns.length ? patterns : DEFAULT_PATTERNS, {
  ignore: ['**/node_modules/**', 'dist/**'],
}).sort();

/** Shows the change inline, so a reviewer can see it is the apostrophe only. */
const preview = (before, after) => {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  return beforeLines.flatMap((line, i) =>
    line === afterLines[i] ? [] : [`      ${i + 1}: ${line.trim()}\n         -> ${afterLines[i].trim()}`],
  );
};

let changed = 0;

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const after = normalizeUzbek(before, { yaml: /\.ya?ml$/.test(file) });
  if (after === before) continue;

  changed += 1;
  console.log(`  ${check ? 'stale' : 'fixed'}  ${file}`);
  for (const line of preview(before, after).slice(0, 5)) console.log(line);

  if (!check) writeFileSync(file, after);
}

if (changed === 0) {
  console.log(`normalize-uzbek: ${files.length} file(s) already normalised.`);
  process.exit(0);
}

if (check) {
  console.error(
    `\nnormalize-uzbek: ${changed} file(s) need normalising.` +
      '\n  Run `pnpm normalize:uzbek` and commit the result.' +
      '\n  Content is normalised automatically in CI — this only fails locally.',
  );
  process.exit(1);
}

console.log(`\nnormalize-uzbek: normalised ${changed} file(s) of ${files.length}.`);
