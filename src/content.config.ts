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
 * Health posts must cite. This is now enforced by information architecture
 * rather than validation: koz-sogligi entries live in their own `sogliq`
 * collection, whose Keystatic counterpart marks `sources` as
 * `length: { min: 1 }` — so the CMS will not let one be saved without a source.
 *
 * The refine below stays as a backstop for hand-edited files. It should be
 * UNREACHABLE through the admin, because no CMS collection offers `koz-sogligi`
 * as a pillar choice. scripts/check-fixtures.mjs proves it still bites.
 *
 * There is deliberately no coverAlt rule. A cover without alt text renders the
 * post WITHOUT the image and logs a warning (see src/lib/cover.ts): Malika opens
 * her post, sees the photo missing, and fixes it herself. Self-correcting
 * feedback beats a failed build she never sees.
 */
const REQUIRE_SOURCES = 'koz-sogligi yozuvlari uchun kamida bitta manba shart';

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
  /**
   * Everyday spellings people actually type: without the ʻ (`koz oldida chivin`)
   * or in Russian (`мушки перед глазами`). Feeds meta[name=keywords] and, later,
   * a search index — never visible body text. Injecting them into the page is
   * cloaking, and on a YMYL page it does real damage.
   */
  altQueries: z.array(z.string()).default([]),
});

/* Refinements are applied inline rather than through a generic helper: a generic
   wrapper erases the inferred object shape, and every downstream
   `entry.data.pillar` silently becomes `any`. */
const requireSources = <T extends { pillar: string; sources: unknown[] }>(d: T) =>
  d.pillar !== 'koz-sogligi' || d.sources.length > 0;

/**
 * Ordinary posts. The pattern is `*` not `**`, so `sogliq/` is NOT swept up
 * here — it is its own collection below, exactly mirroring the Keystatic split.
 */
const posts = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) =>
    z
      .object({ ...entryFields(image), evergreen: z.boolean().default(false) })
      .refine(requireSources, { message: REQUIRE_SOURCES, path: ['sources'] }),
});

/**
 * Health posts. A separate authoring type because a health post genuinely is a
 * different kind of thing: it requires sources, carries a disclaimer, emits
 * MedicalWebPage schema and appears on /koz-sogligi.
 *
 * `pillar` is implied by the collection and never written to the file, so it
 * cannot be set wrong. Public URLs stay flat — these merge into /yozuvlar/<slug>
 * alongside ordinary posts; the split is an authoring concern, not a URL one.
 */
const sogliq = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/posts/sogliq' }),
  schema: ({ image }) =>
    z.object({
      ...entryFields(image),
      pillar: z.literal('koz-sogligi').default('koz-sogligi'),
      evergreen: z.boolean().default(false),
      // Required here, not conditionally: this collection is health posts only.
      sources: z.array(source).min(1, REQUIRE_SOURCES),
    }),
});

/** Same schema as posts; notes are evergreen by default and show no publish date. */
const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: ({ image }) =>
    z
      .object({ ...entryFields(image), evergreen: z.boolean().default(true) })
      .refine(requireSources, { message: REQUIRE_SOURCES, path: ['sources'] }),
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

      /* Search-console tokens. DNS TXT verification is preferable and needs
         none of these; they are the fallback, pasteable from the admin. */
      googleSiteVerification: optionalText,
      yandexVerification: optionalText,
      bingVerification: optionalText,
    }),
});

export const collections = { posts, sogliq, notes, site };
