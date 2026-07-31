import { defineCollection, z, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Six pillars. Slugs stay ASCII so they are safe in URLs and filenames;
 * their Uzbek labels live in src/lib/pillars.ts.
 */
const pillar = z.enum([
  'kundalik', // daily life, mood, habits — the most frequent
  'kitoblar', // books and reading
  'oqish-kasb', // studying, residency prep, being a medical student
  'koz-sogligi', // eye-health explainers for laypeople
  'yol', // career decisions and milestones
  'esse', // personal essays
]);

const source = z.object({
  title: z.string(),
  publisher: z.string(),
  year: z.number().optional(),
  url: z.string().url().optional(),
});

/**
 * The two editorial rules that are enforced mechanically rather than by review.
 * Do not weaken either one.
 *
 *  - Health posts must cite. No unsourced health claim can ship, even by accident.
 *  - A cover image must have alt text.
 *
 * scripts/check-fixtures.mjs proves both still bite, on every CI run.
 */
const REQUIRE_SOURCES = 'koz-sogligi yozuvlari uchun kamida bitta manba shart';
const REQUIRE_COVER_ALT = 'cover berilgan boʻlsa, coverAlt ham shart';

const entryFields = (image: SchemaContext['image']) => ({
  title: z.string(),
  description: z.string().max(200),
  pillar,
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
  cover: image().optional(),
  coverAlt: z.string().optional(),
  sources: z.array(source).default([]),
  reviewedBy: z.string().optional(),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) =>
    z
      .object({ ...entryFields(image), evergreen: z.boolean().default(false) })
      .refine((d) => d.pillar !== 'koz-sogligi' || d.sources.length > 0, {
        message: REQUIRE_SOURCES,
        path: ['sources'],
      })
      .refine((d) => !d.cover || !!d.coverAlt, {
        message: REQUIRE_COVER_ALT,
        path: ['coverAlt'],
      }),
});

/** Same schema as posts; notes are evergreen by default and show no publish date. */
const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: ({ image }) =>
    z
      .object({ ...entryFields(image), evergreen: z.boolean().default(true) })
      .refine((d) => d.pillar !== 'koz-sogligi' || d.sources.length > 0, {
        message: REQUIRE_SOURCES,
        path: ['sources'],
      })
      .refine((d) => !d.cover || !!d.coverAlt, {
        message: REQUIRE_COVER_ALT,
        path: ['coverAlt'],
      }),
});

/** Singletons: now.md, reading.md, men-haqimda.md */
const site = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/site' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().max(200).optional(),
      updated: z.coerce.date().optional(),
      /** now.md: the one short line shown in the homepage "Hozir" strip. */
      strip: z.string().optional(),
      /** reading.md: the "Hozir oʻqiyapman" card. */
      book: z
        .object({
          title: z.string(),
          author: z.string(),
          startedOn: z.coerce.date(),
          progress: z.number().min(0).max(100),
          note: z.string(),
          cover: image().optional(),
          coverAlt: z.string().optional(),
        })
        .optional(),
      portrait: image().optional(),
      portraitAlt: z.string().optional(),
    }),
});

export const collections = { posts, notes, site };
