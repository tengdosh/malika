/**
 * Writing content entries — the bot's half of the schema contract.
 *
 * Nothing here restates the schema. The field list is derived from
 * src/content.config.ts through scripts/lib/content-fields.mjs, and the cover
 * path depth from src/lib/content-paths.js — the same module keystatic.config.ts
 * uses, because the three entry collections do not share a depth and a health
 * post's cover needs one more `../` than an ordinary post's.
 * scripts/check-schema-sync.mjs fails if either import disappears.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { globSync } from 'glob';

import { botFields } from '../../scripts/lib/content-fields.mjs';
import { CONTENT_PATHS, assetPath } from '../../src/lib/content-paths.js';
import { normalizeUzbek } from '../../scripts/lib/normalize-uzbek.mjs';
import { assertSafeSlug, uniqueSlug } from './slug.mjs';

/**
 * Where each kind of entry is written, and which collection path its cover
 * depth is measured from. Keyed by the choice Malika makes in the bot.
 */
export const TARGETS = {
  post: { dir: 'src/content/posts', contentPath: CONTENT_PATHS.posts, evergreen: false },
  sogliq: { dir: 'src/content/posts/sogliq', contentPath: CONTENT_PATHS.sogliq, evergreen: false },
  note: { dir: 'src/content/notes', contentPath: CONTENT_PATHS.notes, evergreen: true },
};

/** The pillar that routes a post into the health collection. */
export const HEALTH_PILLAR = 'koz-sogligi';

/** Assets always land here; only the number of `../` differs per collection. */
const ASSET_DIR = 'posts';

export const assetsDir = () => `src/assets/${ASSET_DIR}`;

/** The `cover:` value for an entry of this kind — derived, never written by hand. */
export const coverPath = (kind, filename) =>
  `${assetPath(TARGETS[kind].contentPath, ASSET_DIR).publicPath}${filename}`;

/* ------------------------------------------------------------------ YAML out */

/** YAML scalars that must be quoted or they change meaning when read back. */
const RESERVED = /^(?:true|false|null|~|yes|no|on|off)$/i;

const needsQuoting = (value) =>
  value === '' ||
  RESERVED.test(value) ||
  /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) ||
  /: |\s#|^\s|\s$|[\n\r]/.test(value) ||
  /^[\d.+-]+$/.test(value);

/** Single-quoted YAML, which only has to escape the quote itself. */
const yamlString = (value) => {
  const text = String(value).replace(/[\r\n]+/g, ' ').trim();
  return needsQuoting(text) ? `'${text.replace(/'/g, "''")}'` : text;
};

/** Dates are written date-only, exactly as Keystatic writes them. */
export const yamlDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
};

function sourcesBlock(sources) {
  return sources
    .map((source) => {
      const lines = [`  - title: ${yamlString(source.title)}`, `    publisher: ${yamlString(source.publisher)}`];
      if (source.year !== undefined && source.year !== null && source.year !== '') {
        lines.push(`    year: ${Number(source.year)}`);
      }
      if (source.url) lines.push(`    url: ${yamlString(source.url)}`);
      return lines.join('\n');
    })
    .join('\n');
}

/**
 * Frontmatter in the field order Keystatic writes.
 *
 * Optional fields that are empty are omitted rather than written as `null` or
 * `''`. Both are accepted by the Zod schema (every optional is wrapped in
 * blankToUndefined), and an absent key is what a human would have written.
 */
/** Carried alongside the frontmatter but never part of it. */
const NOT_FRONTMATTER = new Set(['body', 'slug', 'kind']);

export function buildFrontmatter(data, { kind }) {
  const allowed = new Set(kind === 'sogliq' ? botFields().health : botFields().entry);
  const unknown = Object.keys(data).filter(
    (key) => !allowed.has(key) && !NOT_FRONTMATTER.has(key),
  );
  if (unknown.length) {
    throw new Error(`field(s) not in the content schema: ${unknown.join(', ')}`);
  }

  const lines = [];
  const put = (key, rendered) => {
    if (!allowed.has(key)) return;
    lines.push(`${key}: ${rendered}`);
  };

  put('title', yamlString(data.title));
  put('description', yamlString(data.description));
  if (data.pillar) put('pillar', yamlString(data.pillar));
  put('date', yamlDate(data.date));
  if (data.updated) put('updated', yamlDate(data.updated));
  put('draft', data.draft ? 'true' : 'false');
  put('featured', data.featured ? 'true' : 'false');
  put('evergreen', data.evergreen ? 'true' : 'false');
  if (data.cover) {
    put('cover', yamlString(data.cover));
    if (data.coverAlt) put('coverAlt', yamlString(data.coverAlt));
  }
  if (data.sources?.length) {
    lines.push('sources:');
    lines.push(sourcesBlock(data.sources));
  }
  if (data.reviewedBy) put('reviewedBy', yamlString(data.reviewedBy));
  if (data.altQueries?.length) {
    lines.push('altQueries:');
    for (const query of data.altQueries) lines.push(`  - ${yamlString(query)}`);
  }

  return lines.join('\n');
}

/** The whole file: frontmatter, then the body, normalised as one document. */
export function renderEntry(data, { kind }) {
  const document = `---\n${buildFrontmatter(data, { kind })}\n---\n\n${String(data.body ?? '').trim()}\n`;
  // The same normaliser the site and the CMS pipeline use, so what the preview
  // showed is byte-for-byte what gets committed.
  return normalizeUzbek(document);
}

/* --------------------------------------------------------------- filesystem */

/** Every slug already in use, across all three collections — URLs are shared. */
export function existingSlugs(root = '.') {
  const files = [
    ...globSync('src/content/posts/*.{md,mdx}', { cwd: root }),
    ...globSync('src/content/posts/sogliq/*.{md,mdx}', { cwd: root }),
    ...globSync('src/content/notes/**/*.{md,mdx}', { cwd: root }),
  ];
  return new Set(files.map((file) => file.replace(/.*\//, '').replace(/\.(md|mdx)$/, '')));
}

/**
 * @param {object} data   frontmatter values plus `body`
 * @param {object} options
 * @param {'post'|'sogliq'|'note'} options.kind
 * @param {string} [options.root] repository working copy
 * @returns {{ slug: string, file: string, text: string }}
 */
export function writeEntry(data, { kind, root = '.' }) {
  const target = TARGETS[kind];
  if (!target) throw new Error(`unknown entry kind: ${kind}`);

  const taken = existingSlugs(root);
  const slug = assertSafeSlug(data.slug ?? uniqueSlug(data.title, (s) => taken.has(s)));

  const relative = join(target.dir, `${slug}.md`);
  const file = join(root, relative);
  const text = renderEntry(
    { evergreen: target.evergreen, draft: true, featured: false, ...data },
    { kind },
  );

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return { slug, file: relative, text };
}

/** Reads an entry back, split into frontmatter text and body. */
export function readEntry(file, root = '.') {
  const text = readFileSync(join(root, file), 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${file}: no frontmatter`);
  return { frontmatter: match[1], body: match[2].replace(/^\n+/, '') };
}

/** True when a slug is already used by any collection. */
export const slugTaken = (slug, root = '.') => existingSlugs(root).has(slug);

/** Path helpers used by the image and singleton flows. */
export const SINGLETONS = {
  hozir: 'src/content/site/hozir/index.md',
  oqiyapman: 'src/content/site/oqiyapman/index.yaml',
};

export const entryExists = (file, root = '.') => existsSync(join(root, file));
