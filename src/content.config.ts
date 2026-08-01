import { defineCollection, z, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Six pillars. Slugs stay ASCII so they are safe in URLs and filenames;
 * their Uzbek labels live in src/lib/pillars.ts and in keystatic.config.ts.
 */
const pillar = z.enum([
  'kundalik', // daily life, mood, habits — the most frequent
  'kitoblar', // books and reading
  'oqish-kasb', // studying, residency prep, being a medical student
  'koz-sogligi', // eye-health explainers for laypeople
  'yol', // career decisions and milestones
  'esse', // personal essays
]);

/**
 * A CMS does not write `undefined`. Keystatic writes `null` for a cleared date or
 * image and `''` for a cleared text field, and Zod's `.optional()` rejects both.
 * Every optional field therefore has to accept null and empty string and
 * normalise them back to undefined — otherwise clearing a field in the admin
 * fails the build, which is precisely what must never happen.
 */
const blankToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (value === null || value === '') return undefined;
    return value;
  }, schema.optional());

const optionalText = blankToUndefined(z.string());
const optionalDate = blankToUndefined(z.coerce.date());
const optionalNumber = blankToUndefined(z.coerce.number());
/** A cleared URL field arrives as '' — treat it as absent rather than invalid. */
const optionalUrl = blankToUndefined(z.string().url());

const source = z.object({
  title: z.string(),
  publisher: z.string(),
  year: optionalNumber,
  url: optionalUrl,
});

/**
 * The two editorial rules that are enforced mechanically rather than by review.
 * Do not weaken either one.
 *
 *  - Health posts must cite. No unsourced health claim can ship, even by accident.
 *  - A cover image must have alt text.
 *
 * scripts/check-fixtures.mjs proves both still bite, on every CI run.
 *
 * NOTE: Keystatic has no cross-field validation, so neither rule can be enforced
 * in the CMS before saving — see README "Known gaps". They fail the build instead.
 */
const REQUIRE_SOURCES = 'koz-sogligi yozuvlari uchun kamida bitta manba shart';
const REQUIRE_COVER_ALT = 'cover berilgan boʻlsa, coverAlt ham shart';

const entryFields = (image: SchemaContext['image']) => ({
  title: z.string(),
  description: z.string().max(200),
  pillar,
  date: z.coerce.date(),
  updated: optionalDate,
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
  cover: blankToUndefined(image()),
  coverAlt: optionalText,
  sources: z.array(source).default([]),
  reviewedBy: optionalText,
});

/* The refinements are applied inline rather than through a generic helper: a
   generic wrapper erases the inferred object shape, and every downstream
   `entry.data.pillar` silently becomes `any`. */
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

/**
 * Singletons, laid out the way Keystatic writes them: one directory per
 * singleton containing index.md (with a body) or index.yaml (data only).
 * generateId strips the /index suffix so getEntry('site', 'hozir') still works.
 */
const site = defineCollection({
  loader: glob({
    pattern: '**/index.{md,mdx,yaml,yml}',
    base: './src/content/site',
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx|ya?ml)$/, ''),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: blankToUndefined(z.string().max(200)),
      updated: optionalDate,

      /** hozir: the one short line shown in the homepage "Hozir" strip. */
      strip: optionalText,

      /** oqiyapman: the "Hozir oʻqiyapman" card. */
      book: blankToUndefined(
        z.object({
          title: z.string(),
          author: z.string(),
          startedOn: z.coerce.date(),
          progress: z.coerce.number().min(0).max(100),
          note: z.string(),
          cover: blankToUndefined(image()),
          coverAlt: optionalText,
        }),
      ),

      /** men_haqimda */
      portrait: blankToUndefined(image()),
      portraitAlt: optionalText,
      muassasa: optionalText,
      bitirganYil: optionalText,

      /** sozlamalar — switches and links that belong to Malika, not to a deploy.
          Named exactly as the Keystatic fields so the two cannot drift. */
      telegram: optionalUrl,
      instagram: optionalUrl,
      email: optionalText,
      footerBio: optionalText,
      hisoblagichKorsatilsin: z.boolean().default(true),
      hisoblagichMinimum: z.coerce.number().min(0).default(0),
    }),
});

export const collections = { posts, notes, site };
