#!/usr/bin/env node
/**
 * The full gate. Runs everything, reports everything, then fails once.
 *
 * Deliberately does NOT stop at the first failure (except the build, which the
 * later checks depend on): fixing four problems is one round trip, fixing them
 * one per run is four.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

/*
 * Advisory lock.
 *
 * Several checks write into src/content/ and dist/ — check-fixtures plants
 * deliberately broken posts, check-analytics rewrites the settings singleton and
 * rebuilds four times. Two concurrent runs corrupt each other's fixtures and
 * produce failures that look like real defects but are not; Lighthouse's applied
 * throttling also measures whatever else the machine is doing.
 *
 * This turns that into one clear message instead of a confusing red run.
 */
const LOCK = '.tmp/check.lock';
const stale = (pid) => {
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
};

if (existsSync(LOCK)) {
  const holder = Number(readFileSync(LOCK, 'utf8').trim());
  if (Number.isInteger(holder) && !stale(holder)) {
    console.error(
      `Another \`pnpm check\` is running (pid ${holder}).\n` +
        '  These checks mutate src/content/ and dist/, so two runs corrupt each\n' +
        "  other. Wait for it to finish, or remove .tmp/check.lock if it's dead.",
    );
    process.exit(1);
  }
  rmSync(LOCK, { force: true });
}
mkdirSync('.tmp', { recursive: true });
writeFileSync(LOCK, String(process.pid));
const releaseLock = () => rmSync(LOCK, { force: true });
process.on('exit', releaseLock);
process.on('SIGINT', () => {
  releaseLock();
  process.exit(130);
});

const STEPS = [
  { name: 'uzbek', label: 'Uzbek apostrophes in source (U+02BB / U+02BC)', cmd: ['node', ['scripts/check-uzbek.mjs']] },
  // Content is normalised rather than linted, and CI commits the result back —
  // so this only ever fails for someone running the checks locally, which is
  // exactly who can fix it with `pnpm normalize:uzbek`.
  { name: 'normalized', label: 'Content apostrophes normalised', cmd: ['node', ['scripts/normalize-uzbek.mjs', '--check']] },
  { name: 'contrast', label: 'WCAG AA contrast, both themes', cmd: ['node', ['scripts/check-contrast.mjs']] },
  { name: 'schema', label: 'Zod / Keystatic schema sync', cmd: ['node', ['scripts/check-schema-sync.mjs']] },
  { name: 'slugs', label: 'No slug collisions across collections', cmd: ['node', ['scripts/check-slug-collisions.mjs']] },
  { name: 'types', label: 'TypeScript + Astro content schema', cmd: ['pnpm', ['exec', 'astro', 'check']] },
  { name: 'build', label: 'Production build', cmd: ['pnpm', ['exec', 'astro', 'build']], required: true },
  { name: 'base', label: 'Internal links respect the base path', cmd: ['node', ['scripts/check-base-paths.mjs']] },
  { name: 'glyphs', label: 'Font glyph coverage', cmd: ['node', ['scripts/check-glyphs.mjs']] },
  { name: 'cms-isolation', label: 'No CMS/React JS on public pages', cmd: ['node', ['scripts/check-keystatic-isolation.mjs']] },
  { name: 'og', label: 'Open Graph cards + Uzbek glyphs', cmd: ['node', ['scripts/check-og.mjs']] },
  { name: 'middleware', label: 'Admin auth (Astro middleware)', cmd: ['node', ['scripts/check-middleware.mjs']] },
  { name: 'a11y', label: 'axe + structural a11y', cmd: ['node', ['scripts/check-a11y.mjs']] },
  { name: 'behaviour', label: 'Theme/text-size persistence, reduced motion', cmd: ['node', ['scripts/check-behaviour.mjs']] },
  { name: 'analytics', label: 'Analytics pipeline + outage tolerance', cmd: ['node', ['scripts/check-analytics.mjs']] },
  { name: 'lighthouse', label: 'Lighthouse budget', cmd: ['node', ['scripts/check-lighthouse.mjs']] },
  { name: 'bot', label: 'Telegram bot flows and guardrails', cmd: ['node', ['scripts/check-bot.mjs']] },
  { name: 'fixtures', label: 'Guardrails still bite', cmd: ['node', ['scripts/check-fixtures.mjs']] },
];

const only = process.argv.slice(2);
const steps = only.length ? STEPS.filter((s) => only.includes(s.name)) : STEPS;

const results = [];

for (const step of steps) {
  console.log(`\n\x1b[1m▸ ${step.label}\x1b[0m`);
  const [command, args] = step.cmd;
  const { status } = spawnSync(command, args, { stdio: 'inherit' });
  const ok = status === 0;
  results.push({ ...step, ok });

  if (!ok && step.required) {
    console.error(`\n\x1b[31m${step.label} failed — the remaining checks need a build.\x1b[0m`);
    break;
  }
}

console.log('\n\x1b[1m── summary ─────────────────────────────────\x1b[0m');
for (const r of results) {
  const mark = r.ok ? '\x1b[32mpass\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  ${mark}  ${r.label}`);
}
const skipped = steps.length - results.length;
if (skipped > 0) console.log(`  \x1b[33mskip\x1b[0m  ${skipped} check(s) not run`);

const failed = results.filter((r) => !r.ok).length;
if (failed > 0 || skipped > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
