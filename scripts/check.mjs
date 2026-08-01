#!/usr/bin/env node
/**
 * The full gate. Runs everything, reports everything, then fails once.
 *
 * Deliberately does NOT stop at the first failure (except the build, which the
 * later checks depend on): fixing four problems is one round trip, fixing them
 * one per run is four.
 */
import { spawnSync } from 'node:child_process';

const STEPS = [
  { name: 'uzbek', label: 'Uzbek apostrophes (U+02BB / U+02BC)', cmd: ['node', ['scripts/check-uzbek.mjs']] },
  { name: 'contrast', label: 'WCAG AA contrast, both themes', cmd: ['node', ['scripts/check-contrast.mjs']] },
  { name: 'schema', label: 'Zod / Keystatic schema sync', cmd: ['node', ['scripts/check-schema-sync.mjs']] },
  { name: 'slugs', label: 'No slug collisions across collections', cmd: ['node', ['scripts/check-slug-collisions.mjs']] },
  { name: 'types', label: 'TypeScript + Astro content schema', cmd: ['pnpm', ['exec', 'astro', 'check']] },
  { name: 'build', label: 'Production build', cmd: ['pnpm', ['exec', 'astro', 'build']], required: true },
  { name: 'glyphs', label: 'Font glyph coverage', cmd: ['node', ['scripts/check-glyphs.mjs']] },
  { name: 'cms-isolation', label: 'No CMS/React JS on public pages', cmd: ['node', ['scripts/check-keystatic-isolation.mjs']] },
  { name: 'a11y', label: 'axe + structural a11y', cmd: ['node', ['scripts/check-a11y.mjs']] },
  { name: 'behaviour', label: 'Theme/text-size persistence, reduced motion', cmd: ['node', ['scripts/check-behaviour.mjs']] },
  { name: 'analytics', label: 'Analytics pipeline + outage tolerance', cmd: ['node', ['scripts/check-analytics.mjs']] },
  { name: 'lighthouse', label: 'Lighthouse budget', cmd: ['node', ['scripts/check-lighthouse.mjs']] },
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
