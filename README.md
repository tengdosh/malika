# malika-bobonazarova.uz

Malika Bobonazarovaning shaxsiy blogi. Astro 5, static output, Uzbek (Latin) only.

This is **a personal blog about a person**, not a portfolio about a doctor. Most
posts are not about medicine. There is no booking, consultation, pricing, patient
form or lead capture anywhere, and there never will be.

```bash
pnpm install
pnpm dev            # http://localhost:4321
pnpm build
pnpm check          # the full gate — see "Checks" below
```

---

## Adding a post

Create `src/content/posts/<slug>.md`. The filename is the URL:
`src/content/posts/yozgi-kitoblar.md` → `/yozuvlar/yozgi-kitoblar`.

```yaml
---
title: Yozgi kitoblar
description: >-
  Bir-ikki jumla. Roʻyxat sahifalarida va qidiruv natijalarida koʻrinadi.
pillar: kitoblar
date: 2026-07-05
---

Matn shu yerdan boshlanadi.
```

### Frontmatter

| Field | Required | Notes |
|---|---|---|
| `title` | yes | |
| `description` | yes | max 200 characters; used as the standfirst and meta description |
| `pillar` | yes | one of the six slugs below |
| `date` | yes | `YYYY-MM-DD` |
| `updated` | no | shown in the byline and used as `lastReviewed` on health posts |
| `draft` | no | `true` hides it from the built site; still visible in `pnpm dev` |
| `featured` | no | `true` puts it in the large slot on the homepage |
| `evergreen` | no | shows "Yangilanib boradi" instead of a date (default `true` for notes) |
| `cover` | no | path relative to the file, e.g. `../../assets/covers/x.jpg` |
| `coverAlt` | **if `cover`** | meaningful Uzbek alt text |
| `sources` | **if `koz-sogligi`** | list of `{title, publisher, year?, url?}` |
| `reviewedBy` | no | renders "[Ism] tomonidan koʻrib chiqilgan" near the byline |

### The two editorial rules

They are enforced differently, because they are different problems.

**Sources on health posts — solved by information architecture.** Health posts
live in their own collection, `sogliq`, whose Keystatic counterpart marks
`sources` as `length: { min: 1 }`. The admin will not let one be saved without a
source, so the rule is met *before* anything reaches the build. `koz-sogligi` is
not offered as a pillar anywhere else, which makes the Zod `.refine` a backstop
for hand-edited files and **unreachable through the CMS**. `check-schema-sync`
asserts both of those structural facts, not just the field names.

The alternative — withhold the post and warn — was rejected for this rule: the
post silently wouldn't appear and Malika would have no way to find out why. Build
logs are not a channel to her.

**Cover alt text — solved by withholding the image.** A `cover` with no
`coverAlt` does **not** fail the build. The post renders without the image and
`src/lib/cover.ts` logs a warning naming the entry. That failure *is* visible to
her: she opens the post, the photo is missing, and she fixes it. Self-correcting
feedback beats a build failure she never sees. An image with no alt text is
invisible to screen readers, so shipping it silently was never an option either —
withholding is the only outcome that is both accessible and non-blocking.

The same rule applies to the book cover on the reading card.

`scripts/check-fixtures.mjs` re-proves all of this on every CI run, including
that a missing `coverAlt` **succeeds** and produces a warning.

### Pillars

| Slug | Label | For |
|---|---|---|
| `kundalik` | Kundalik | daily life, mood, habits — the most frequent |
| `kitoblar` | Kitoblar | books and reading |
| `oqish-kasb` | Oʻqish va kasb | studying, residency prep, being a student |
| `koz-sogligi` | Koʻz sogʻligʻi | eye-health explainers for laypeople |
| `yol` | Yoʻl | career decisions and milestones |
| `esse` | Esse | personal essays |

Slugs stay ASCII so they are safe in URLs and filenames; the Uzbek labels live in
`src/lib/pillars.ts`. To add a pillar, edit the enum in `src/content.config.ts`
**and** the maps in `src/lib/pillars.ts`.

### Health posts are a separate collection

`src/content/posts/sogliq/*` — same schema as `posts`, minus `pillar` (implied by
the collection, never written to the file) and with `sources` genuinely required.

**Public URLs stay flat.** Both collections merge in `getPosts()` and render at
`/yozuvlar/<slug>`; the split is an authoring concern, not a URL one. That means
the two collections share a URL namespace, so
`scripts/check-slug-collisions.mjs` fails the build if both claim the same slug —
Astro's own duplicate-route error names neither file.

This is honest rather than awkward: a health post genuinely is a different kind
of thing. It requires sources, carries a disclaimer, emits `MedicalWebPage`
schema and appears on `/koz-sogligi`. Presenting it as its own type in the admin
reflects what was already true.

### Notes (`/qaydlar`)

Same schema, different folder: `src/content/notes/`. Notes are `evergreen` by
default, sorted by last updated, and show "Yangilanib boradi" instead of a date.
They are for things that keep growing — study notes, running lists.

### Health posts

A `koz-sogligi` post automatically gets:

- a **`manbalar bilan`** badge next to its pillar chip,
- a numbered **Manbalar** list rendered from `sources`,
- the **medical notice** at the end of the article,
- `MedicalWebPage` JSON-LD with `lastReviewed` and `citation` derived from `sources`.

`url` on a source is optional — leave it out rather than guessing one. The seeded
floaters post cites AAO, NEI and Kanski’s without URLs for exactly that reason.

---

## Updating `now.md` and `reading.md`

Both live in `src/content/site/` and are singletons.

**`now.md`** drives two things: the `strip` field is the one line in the blush
block on the homepage, and the body is the full `/hozir` page. Update `updated:`
when you change it.

```yaml
---
title: Hozir
updated: 2026-07-28
strip: >-
  Ordinaturaga hujjat topshirdim va javob kutyapman.
---

Full page body here.
```

**`reading.md`** is the "Hozir oʻqiyapman" card. `progress` is 0–100.

```yaml
---
title: Hozir oʻqiyapman
book:
  title: Daftar hoshiyasidagi bitiklar
  author: Oʻtkir Hoshimov
  startedOn: 2026-07-12
  progress: 42
  note: Kuniga bir-ikki sahifadan oʻqiyman.
  cover: ../../assets/books/hozir-oqiyapman.jpg
  coverAlt: Kitob muqovasi
---
```

`src/content/site/men_haqimda/index.md` is the `/men-haqimda` body and holds the
hero portrait. Institution and graduation year are editable fields (`muassasa`,
`bitirganYil`), both currently blank — they render only when filled in.

---

## Checks

`pnpm check` runs all of these and reports a summary. Individual runs:
`pnpm check:uzbek`, `check:glyphs`, `check:a11y`, `check:lighthouse`,
`check:fixtures`, or `node scripts/check.mjs uzbek a11y` for a subset.

### Uzbek apostrophes

The single most common way this codebase breaks.

| Character | Codepoint | Used for |
|---|---|---|
| `ʻ` | U+02BB | `Oʻ` / `Gʻ` |
| `ʼ` | U+02BC | tutuq belgisi (`maʼrifiy`) |
| `’` | U+2019 | foreign stem + Uzbek suffix (`hero’dan`) |

A straight `'` or a left quote `‘` in an Uzbek word is always wrong. Editors,
phone keyboards and paste-from-Word all produce them silently, and the result
renders in a fallback face — visible in almost every sentence.

`scripts/check-uzbek.mjs` scans `src/content/**` and every `.astro` file.

> **One deviation from the spec, deliberate.** The rule is written as
> `[oOgG]['‘]`, but that also matches every JavaScript string literal ending
> in `o` or `g` — `from './EntryRow.astro'`, `'/og-default.png'`,
> `[data-textsize='lg']`. On this codebase that was **55 hits, none of them
> Uzbek**, and a lint that noisy gets switched off within a week. The shipped
> rule adds a lookahead for a letter: `[oOgG]['‘](?=\p{L})`. In Uzbek these
> are always word-internal (`boʻlsa`, `sogʻliq`, `Gʻafur`), so this catches every
> genuine violation and no code. The fixture test proves it still fails on
> `ko'p`.

### Glyphs

`scripts/check-glyphs.mjs` does two things:

1. Every shipped font file must contain **U+02BB and U+02BC** (Caveat exempt —
   see Typography).
2. Every distinct character in the built HTML must be renderable by the body and
   display faces. This is the check that matters, because the faces are subset:
   a missing character would silently fall back mid-sentence.

**The coverage pass never blocks a deploy on Malika's writing.** It splits by
source:

| Character comes from | Result |
|---|---|
| `src/content/**` (or a markdown transform of it) | **warning** — build continues, glyph falls back to a system font |
| a `.astro` file or `src/lib` UI string | **fail** — a developer is watching CI and the fix is one line |

This matters more than it looks. Malika writes on a phone: `…`, `—`, `«»`,
arrows and pasted characters are inevitable. If an unexpected character failed
CI she would save a post, never see the failure, and the site would silently
stop updating — the exact failure mode the apostrophe rules exist to prevent.

**General rule for this project: nothing Malika saves may block a deploy.** The
only exceptions are the two schema rules (required `sources`, required
`coverAlt`), which are deliberate and surface immediately on save rather than in
CI.

The analysis also runs as an Astro integration on `astro:build:done`, so the
summary line and any warnings appear in the deploy build log, not only in
`pnpm check`. A warning nobody sees in CI is a warning nobody sees.

Some characters cannot be fixed by widening the charset: **Alegreya's latin
subset contains no horizontal arrows at all** (`→ ← ↔`), nor `≈ ≤ ≥ ≠ ∞ √ №`,
nor any emoji. Subsetting cannot add a glyph the source font lacks, so those
warn and fall back by design. `UNAVAILABLE_IN_SOURCE` in the font manifest
documents the list.

### Contrast

`scripts/check-contrast.mjs` computes every foreground/background pairing the
stylesheet actually uses, in both themes, straight from `tokens.css`, and fails
below AA (4.5:1). It prints the whole table on every run.

It caught one real failure during the build: chip hover was `--ink` on `--blush`,
which is 6.85:1 in light but **2.26:1 in dark**. Hover is now `--paper` on
`--plum` (7.45 / 9.42).

**When you add a colour pairing, add it to `PAIRINGS` in that script.** Computing
it is the rule; eyeballing it is how the dark theme broke.

Three token rules, each from a measured failure:

1. `--blush` is **never** a text colour. It is 2.18:1 on `--paper`. Backgrounds,
   borders and dividers only.
2. **Never apply `opacity` to text.** If text must recede, use `--muted`. The
   a11y check fails the build on any text with computed opacity < 1.
3. One accent only: `--plum`, with `--blush` as its soft tint.

### Accessibility

`scripts/check-a11y.mjs` runs axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`,
`best-practice`) against `/`, a post page and `/men-haqimda`, **in both themes**,
and requires zero violations. On top of axe it asserts what axe cannot see:

- no rendered interface text below 13px (`--t-meta`),
- no `opacity` on text (animations are settled first, since the hero entrance
  legitimately animates opacity from 0),
- exactly one `h1` per page and no skipped heading levels,
- no horizontal scroll — including at **200% text size**.

That last one found three real bugs: `body`'s flex children blowing out to
min-content, grid tracks without a `minmax(0, …)` floor, and the CTA button's
label forcing the page wider than the viewport.

> `overflow-wrap: break-word` does **not** reduce a track's intrinsic min-content
> size — only `anywhere` does. Long Uzbek headings therefore widen any grid track
> declared as bare `1fr`. Every track in this stylesheet uses `minmax(0, 1fr)`.

### Behaviour

`scripts/check-behaviour.mjs` proves the two things that are easy to claim and
easy to get wrong:

- theme and text size persist across reloads **and across pages**, and are
  correct in the *first painted frame* — it hooks `requestAnimationFrame` before
  anything paints and asserts the root attributes and computed styles are
  already right, which is what "no flash" actually means;
- `prefers-color-scheme` is respected on a first visit;
- the hero animation runs by default (5 staggered elements) and **does not exist**
  under `prefers-reduced-motion`, with the hero at opacity 1 and its content in
  the DOM either way.

### Lighthouse

Budget: Performance ≥ 95, Accessibility 100, Best Practices ≥ 95, SEO 100,
LCP < 1500ms. Current: **100 / 100 / 100 / 100**, LCP 455–640ms.

`scripts/check-lighthouse.mjs` runs each route twice, because the two runs answer
different questions:

- **`simulate`** (Lighthouse's default) — Lantern *predicts* timings from a fast
  trace. This produces the category scores everyone quotes, so the **score**
  budget is gated here.
- **`devtools`** — the same 4G conditions (150ms RTT, 1.6 Mbps, 4× CPU) actually
  applied to the browser and *measured*. This is what a real phone experiences,
  so the **LCP** budget is gated here.

For this site Lantern predicts ~1.8s LCP where applied throttling measures ~0.6s.
Both numbers print on every run; neither is hidden.

For calibration: a **300-byte HTML file** with no CSS, fonts or images measures
FCP 624ms / LCP 755ms through the same Lantern harness. Lantern charges roughly
one full round trip (~560ms simulated) per resource on the critical path, so its
absolute numbers are pessimistic for any site that self-hosts a webfont.

The local audit server (`scripts/lib/browser.mjs`) serves brotli/gzip, because
any sane web server does. Measuring against uncompressed HTML inflated FCP by
~700ms — an artefact of the harness, not the site. See Deployment for the
headers the server must set.

---

## Typography

Display is **Alegreya**, body and UI are **Alegreya Sans**. Both cover Uzbek and
Cyrillic, so Russian stays possible later.

**Do not substitute a font without running the glyph check and reporting the
result.** Fraunces and Figtree were both rejected because neither contains
U+02BB — every `Oʻ` and `Gʻ` would have fallen back to a different face.

| Font | U+02BB | U+02BC | Verdict |
|---|---|---|---|
| Alegreya | ✅ | ✅ | display |
| Alegreya Sans | ✅ | ✅ | body / UI |
| Fraunces | ❌ | ✅ | rejected |
| Figtree | ❌ | ❌ | rejected |
| Caveat | ❌ | ✅ | signature only |

Two things worth knowing before touching `scripts/font-manifest.mjs`:

**Only the `latin` subset ships.** Google's `latin` unicode-range explicitly
contains `U+02BB-02BC`, so Uzbek is fully covered by the same file as the
surrounding text. The `latin-ext` subsets contain U+02BC but **not** U+02BB — if
one ever lands in `public/fonts/`, the per-file check fails, correctly. If
latin-ext genuinely becomes necessary (a book title with `š`, `ł`, `č`), add
those files *and* relax the per-file check to a per-family union, keeping the
rendered-text coverage pass as the real guarantee.

**Faces are subset further, to an explicit charset.** The stock `latin` subset
carries ~300 glyphs — accented Latin-1 for French, German and Spanish, currency
symbols, arrows — almost none of which Uzbek uses. `TEXT_CHARSET` keeps ASCII,
the Uzbek modifier letters, typographic punctuation, and the accented Latin-1 and
Turkish letters that turn up in foreign names. The coverage pass is what makes
this safe: add a character to a post, and if the subset misses it the build
fails with the exact codepoint and the page it appeared on.

`@fontsource-variable/alegreya-sans` **does not exist** — Alegreya Sans has no
variable version upstream. The static `@fontsource/alegreya-sans` cuts (400, 500,
700, 400-italic) are used instead.

Font payload after subsetting: **7 files, 154 KB**, of which 3 are preloaded
(body 400, display roman, display italic — the faces the LCP heading needs).

```bash
pnpm fonts    # re-copies + re-subsets from node_modules, regenerates fonts.css
```

`src/styles/fonts.css` is **generated**. Edit `scripts/font-manifest.mjs` instead.

### Caveat

Caveat is used for **the single word "Malika" in the signature and nothing else.**
It has no U+02BB, so Uzbek text must never inherit it. The face is subset to
exactly those five glyphs (73 KB → 5.4 KB).

It is a placeholder: `src/components/Signature.astro` has a `TODO(signature)`
for swapping in an SVG scan of her real handwriting, after which Caveat and the
`--hand` token should both be deleted.

---

## Design

Tokens live in `src/styles/tokens.css` and are copied verbatim from the approved
spec. **Do not adjust the hex values.**

### The arch

The motif is **"rounded corners, one corner cut sharp", scaled to element size**
— not a single shared radius. There is deliberately no `.arch` utility class:
applying one value to every box is what turned the "Hozir" strip into a dome.

| Element | Token | Value |
|---|---|---|
| portrait | `--arch-portrait` | `11rem 11rem 1.1rem 1.1rem` — **the only dome** |
| entry thumbnail | `--arch-thumb` | `2.2rem 2.2rem .35rem 2.2rem` |
| featured image, article hero, reading card, subscribe block | `--arch-media` | `1.6rem 1.6rem .4rem 1.6rem` |
| byline avatar | `--arch-avatar` | `2rem 2rem .5rem .5rem` |
| "Hozir" strip | `--arch-strip` | `1.1rem 1.1rem 1.1rem .3rem` |
| pillar chip | `--arch-chip` | `.7rem .7rem .7rem .2rem` |
| book cover | `--arch-book` | `.35rem .9rem .9rem .35rem` (sharp on the spine side) |
| sources block | `--arch-sources` | `1.2rem` |
| notice, entry hover | `--arch-soft` | `1rem` |
| Telegram button | — | `999px` |

Not on inputs, the masthead or the footer.

The homepage renders in exactly this order, and the rhythm is the design:
masthead → hero → "Hozir" strip → Soʻnggi yozuvlar (one featured entry, then
rows) → "Hozir oʻqiyapman" → Telegram → footer.

**Do not add** a topics grid, sidebar, related posts, search, tag cloud or
widgets. They were deliberately removed; re-adding them is a regression. Entries
are **rows, not cards**, so the list stays legible at 200 posts.

### Missing covers

`cover` is optional, and the no-cover path is a first-class layout, not a
fallback. The featured slot becomes a text-only treatment with a blush rule, a
larger title and more air; list rows collapse to a single column with no
thumbnail gutter. `yozgi-kitoblar` and `nega-oftalmologiya` ship without covers
so both states stay exercised — **keep at least one post without a cover.**

If a missing photo made a post look broken, she would stop publishing rather than
post without one.

### Motion

One entrance animation: hero elements rise 0.7rem with a fade, staggered
50/120/200/270/400ms, 800ms, `cubic-bezier(.2,.7,.3,1)`. It is declared inside
`@media (prefers-reduced-motion: no-preference)`, so the default state is
*visible* — if the rule never applies, content is fully rendered rather than
stuck at opacity 0. Content is always in the DOM either way.

No scroll-triggered reveals, no parallax, no page transitions.

### Text size and theme

The only client JS on the site, besides the analytics tag: a `<head>` snippet
that restores both from `localStorage` before first paint, and a listener for the
two controls.

Text size scales **up only** — 100% / 112.5% / 125%. There is no smaller step
because 93.75% would push `--t-meta` (13px) below the type floor.

The visible pressed state is driven by `html[data-textsize]` / `html[data-theme]`
in CSS, set before paint, so it is never briefly wrong on screen; `aria-pressed`
is synced separately for assistive tech.

> The spec's masthead list mentions only a text-size control. A **theme toggle**
> was added next to it, because "theme persisted in `localStorage`" is meaningless
> without a way to set it, and both themes must work. It is one icon button, same
> visual treatment as the text-size group.

---

## Structure

```
src/
  content.config.ts     collections + the two enforced editorial rules
  content/
    posts/              /yozuvlar/<slug>
    notes/              /qaydlar/<slug>
    site/               now.md, reading.md, men-haqimda.md
  lib/
    site.js             canonical origin, credential line, audit routes
    pillars.ts          slugs -> Uzbek labels
    entries.ts          sorting, drafts, featured/rest split
    jsonld.ts           Person / BlogPosting / MedicalWebPage
    format.ts           Uzbek dates, hand-rolled (no ICU dependency)
  styles/
    tokens.css          verbatim from the spec — do not edit values
    fonts.css           GENERATED by pnpm fonts
    global.css          everything else
  components/           one component per named piece of the composition
  layouts/              Base.astro (shell), Article.astro
scripts/
  font-manifest.mjs     the single source of truth for shipped fonts
  sync-fonts.mjs        copy + subset from node_modules, regenerate fonts.css
  gen-placeholders.mjs  regenerate placeholder imagery
  check-*.mjs           the gate
  shots.mjs             screenshot routes from dist/ for visual review
```

## The CMS

[Keystatic](https://keystatic.com) at `/keystatic`. Content stays as Markdown in
this repo — no database, no second host. Saving commits to GitHub, which triggers
a deploy; the live site updates in roughly a minute or two.

```bash
pnpm dev     # local mode: writes straight to the working tree, no GitHub needed
```

Malika's own guide is [docs/malika-uchun.md](docs/malika-uchun.md).

### Rendering

Keystatic needs server rendering, so the project has an SSR adapter
(`@astrojs/node`, standalone) and `output: 'static'` behaves as hybrid. **Only
three routes render on demand** — `/keystatic`, `/api/keystatic/*` and
`/admin/statistika`; every public page is still prerendered.

`scripts/check-keystatic-isolation.mjs` asserts the thing that actually matters:
no public page references React, Keystatic, `astro-island` or any hydration
runtime, and no public page loads an external script at all. A stray `client:`
directive would otherwise ship the editor bundle to every reader.

> The adapter splits the build, so every check resolves the served directory
> through `resolveDistDir()` in `scripts/lib/browser.mjs`: `dist/client` when
> present, else `dist`.

### Configuration

`keystatic.config.ts` is bundled into the **browser** as well as the server, so
it can only read `import.meta.env` — reading `process.env` there breaks the admin
at hydration with `process is not defined`. Every variable it touches is
therefore `PUBLIC_` prefixed, and none of them are secrets. The GitHub App client
secret and `KEYSTATIC_SECRET` are read server-side by the injected API route and
never appear in this file.

Note `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` — this is Astro, so the prefix is
`PUBLIC_`, not `NEXT_PUBLIC_`.

### Schema drift

Two schemas describe the same content: the Zod schema in `src/content.config.ts`
(what the build accepts) and `keystatic.config.ts` (what the admin writes). If
they diverge, Malika saves a post that fails the build, never sees the error, and
the site silently stops updating.

`scripts/check-schema-sync.mjs` compares both against one canonical field list
and fails on any mismatch. It is an explicit test, not a generator: a schema
change should be a deliberate edit in three places.

### What a CMS writes

Keystatic writes `null` for a cleared date or image and `''` for a cleared text
field. Zod's `.optional()` rejects both, so **every optional field goes through
`blankToUndefined`** in `src/content.config.ts`. Without it, clearing a field in
the admin fails the build — exactly the outcome the whole design is built to
avoid. A fixture covers this.

Images use `directory: 'src/assets/posts'` with a `publicPath` relative to the
content file, so `astro:assets` still optimises uploads. A fixture builds a post
in Keystatic's exact output format and asserts the result has AVIF, WebP and a
srcset.

## Deployment

Self-hosted Node. `@astrojs/node` in `standalone` mode; `output` stays `'static'`,
so all but three routes are prerendered files and the server exists only for the
ones that cannot be.

### What the server must provide

| | |
|---|---|
| Node | 22 or newer (the build uses `AbortSignal.timeout`, `Array.at`, native `fetch`) |
| Package manager | pnpm (a `pnpm-lock.yaml` is committed) |
| Build | `pnpm install --frozen-lockfile --prod=false` then `pnpm build` |
| Run | `pnpm start` — i.e. `node dist/server/entry.mjs` |
| Listens on | `HOST` / `PORT` (defaults `localhost:4321`) |
| Process | anything that keeps one Node process alive and restarts it on failure |

The build emits `dist/client` (prerendered pages and assets) and `dist/server`
(the request handler). Both are needed at runtime — the server serves the client
directory itself, so a reverse proxy can forward everything to it, or serve
`dist/client` directly and forward only the on-demand routes.

### Environment

**Build time** — read while `pnpm build` runs, baked into the output:

| Variable | Effect if unset |
|---|---|
| `SITE_ORIGIN` | falls back to the canonical origin in `src/lib/site.js` |
| `SITE_BASE` | `/` — set only when serving from a subpath |
| `PUBLIC_SITE_ORIGIN` | canonical/OG URLs fall back as above |
| `PUBLIC_NOINDEX` | site is indexable; set to `1` for any non-canonical deploy |
| `ANALYTICS_PROVIDER` + provider keys | no view counters, empty stats page, build still succeeds |
| `INDEXNOW_KEY` | no IndexNow submission |
| `PUBLIC_KEYSTATIC_*` | CMS falls back to local-file storage |

**Runtime** — read per request by the running server:

| Variable | Effect if unset |
|---|---|
| `ADMIN_USER`, `ADMIN_PASSWORD` | `/admin/*` returns **503**, never a public page |
| `KEYSTATIC_GITHUB_CLIENT_ID` / `_SECRET`, `KEYSTATIC_SECRET` | CMS login fails |
| `HOST`, `PORT` | `localhost:4321` |

`ADMIN_*` are read from `process.env` at request time, so changing them needs a
restart but not a rebuild.

### Routes

| Route | Rendering | Must be |
|---|---|---|
| everything public | prerendered | reachable |
| `/keystatic`, `/api/keystatic/*` | on demand | reachable (self-authenticates via GitHub) |
| `/admin/*` | on demand | reachable, but **never public** — auth is in the app |

`/admin/statistika` is deliberately **not** prerendered. Astro middleware runs
per request only for on-demand routes; for a prerendered page it runs once at
build time, so a prerendered admin page would be a static file the web server
hands to anyone. `scripts/check-keystatic-isolation.mjs` fails if it ever
reappears in the static output.

### Headers and redirects the app does not do

These used to come from platform config. They are now the server's job:

| Requirement | Why |
|---|---|
| Redirect every non-canonical host to the canonical origin, 301 | one indexable hostname |
| `Cache-Control: public, max-age=31536000, immutable` on `/_astro/*` and `/fonts/*` | content-hashed and subset filenames; safe to pin |
| Serve br/gzip for HTML, CSS, JS, SVG, XML | measured ~700ms of FCP on a slow connection |

The admin's own `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`
are set by the middleware, so they survive any host.

### Do not run the checks on the machine that serves the site

`pnpm check` rebuilds `dist/` several times, with the *default* configuration —
no `SITE_BASE`, no `PUBLIC_NOINDEX`. If the running server reads that same
`dist/`, the next restart will serve a differently-configured site: with a base
path configured, every URL 404s.

Two ways out, in order of preference:

1. **Serve from a directory the checks do not touch.** Build in a checkout, copy
   `dist/` to the serve location, point the process there. `scripts/rebuild.sh`
   is the natural place to add the copy.
2. **Never run `pnpm check` on the serving machine.** Workable, but it relies on
   nobody forgetting.

The same applies to anything else that builds concurrently — two builds sharing
one working tree tear `dist/` apart and produce
`Cannot find module .../chunks/...` from a half-written build.

### Rebuild

View counts are baked in, so they are only as fresh as the last build.
`scripts/rebuild.sh` is the contract: it installs, builds, and runs
`$RESTART_COMMAND` if one is set.

```bash
RESTART_COMMAND='<whatever restarts the process>' scripts/rebuild.sh
```

Scheduling it is the server's business. Running it without `RESTART_COMMAND`
only rebuilds — the live process keeps serving the previous build until it is
restarted.

## SEO and sharing

The technical foundation — sitemap, robots, canonical origin, Person /
BlogPosting / MedicalWebPage schema, RSS, `lang="uz"`, SEO 100, sub-second LCP —
predates this section. What follows is what was added on top, ordered by how much
it actually matters for a new `.uz` domain with no history: **the share preview
is worth more right now than anything on the ranking side**, because the first
readers arrive from Telegram, not Google.

### Per-post Open Graph cards

`/og/<slug>.png`, rendered at build time by satori + resvg. No runtime service.

- Design uses the existing tokens only — `--paper` ground, `--blush` rule,
  `--plum` accent, Alegreya title, the wordmark's lens dot.
- **A cover image wins when a post has one**; the generated card is the fallback
  for posts without.
- Long titles wrap: the size steps down with length, and `check-og.mjs` measures
  a real 87-character Uzbek title to prove it lands on two lines and stays inside
  the canvas.
- The endpoint **cannot fail a build**. Any error serves `og-default.png` and
  logs a warning.

Two things future-you will trip over:

> **satori cannot read woff2, and it cannot read variable fonts.** `pnpm fonts`
> therefore also decompresses the shipped subsets into `.og-fonts/*.ttf` and pins
> Alegreya's `wght` axis to a static instance — an unpinned variable font makes
> satori throw `Cannot read properties of undefined`. Those TTFs come from the
> very same subset files the browser gets, so a card can never contain a glyph
> the page itself cannot render.

> **`.og-fonts/` is resolved from `process.cwd()`, not `import.meta.url`.** Vite
> bundles the renderer into the SSR build, so a module-relative path resolves to
> `dist/.og-fonts` and every card silently falls back to the default image — a
> failure that looks like success.

`check-og.mjs` re-proves the Uzbek glyph work in this second text stack: satori
drops a glyph it cannot find without complaining, so a card can lose every `Oʻ`
and still "render". It asserts the render fonts cover
`oʻqish, gʻamxoʻrlik, sanʼat`, and that the assertion **fails** on Caveat — a
real font that genuinely lacks U+02BB.

**Forcing a preview refresh.** Telegram, WhatsApp and Facebook cache previews
hard. After changing a title or card:

| Where | How |
|---|---|
| Telegram | message [@WebpageBot](https://t.me/WebpageBot) with the URL |
| Facebook / WhatsApp | [Sharing Debugger](https://developers.facebook.com/tools/debug/) → *Scrape Again* |
| X / Twitter | [Card Validator](https://cards-dev.twitter.com/validator) |
| Anywhere else | append `?v=2` to the shared URL — a different URL is a different cache entry |

### Uzbek query variants

People type without diacritics (`koz oldida chivin`, not `koʻz`) and a sizeable
share search in Russian (`мушки перед глазами`). A title of `Koʻz oldidagi
chivinlar` misses much of both.

`altQueries` — *Boshqacha qidiriladigan soʻzlar* in the admin — is an optional
array that feeds `meta[name="keywords"]` and, when a search page exists, its
index. **It never reaches visible body text and never a hidden div**: that is
cloaking, and on a YMYL health page it does real damage. A fixture proves it,
using a nonsense token that could only appear in the body if we put it there.

Slugs stay ASCII and diacritic-free, which they already were.

### IndexNow

Pings Bing and Yandex with every changed URL on each deploy, from
`astro:build:done`. Google ignores IndexNow — it is reached through Search
Console and the sitemap.

- Set `INDEXNOW_KEY` (8–128 chars, letters/digits/dashes). The key file is
  emitted at `/<key>.txt` automatically.
- **Failure is always a warning**, never a build error.
- **A noindexed deploy is never submitted.** Asking Bing to index a staging copy
  is worse than not submitting at all, so any build with `PUBLIC_NOINDEX=1` skips
  it by design.

### Verification tokens

`googleSiteVerification`, `yandexVerification` and `bingVerification` live in
`sozlamalar`, so they can be pasted in from the admin with no code change. Each
renders a meta tag **only when set**.

> DNS TXT verification is preferable and needs none of these. They are the
> fallback for when DNS is not available.

### Structured data

| Schema | Where |
|---|---|
| `Person` | `/` and `/men-haqimda` |
| `WebSite` (`inLanguage: uz`) | `/` |
| `BlogPosting` | every post, `author` referencing the `Person` `@id` |
| `BreadcrumbList` | every post — Bosh sahifa → Yozuvlar/Qaydlar → title |
| `MedicalWebPage` | koz-sogligi posts only, `lastReviewed` from `updated` ?? `date` |

Plus `article:published_time` / `article:modified_time`, `og:image:width/height`,
and a self-referencing `hreflang` (`uz` + `x-default`) — harmless today, correct
the day `/ru` lands.

## Known gaps

Reported rather than worked around:

- **Keystatic still has no cross-field validation** — `fields.array` supports only
  `length.min` and `fields.conditional` reshapes stored data. Both rules that
  needed it have been solved another way (see "The two editorial rules"), so this
  is no longer a live problem, but it constrains any future rule of the form
  "field X is required when field Y is Z". The way out is usually a separate
  collection, not a validator.
- **Keystatic's own UI chrome is English** ("Add", "Create", "Dashboard"). Every
  label, description and navigation group we control is Uzbek; the surrounding
  chrome is not localisable. `docs/malika-uchun.md` opens with a glossary of every
  English term she will actually meet.

## Upgrade risks

Things most likely to break on a dependency bump, and what to check:

- **Admin bar instead of CMS sidebar injection.** No DOM injection is used
  anywhere: a CMS, when installed, is linked from the admin bar via
  `ADMIN.cmsPath` in `src/lib/site.js`. Nothing here depends on a CMS's internal
  markup, so a CMS upgrade cannot break navigation. The direct URL is documented
  for Malika regardless.
- **Umami API shape.** `src/lib/analytics/umami.ts` targets Umami v2
  (`/api/websites/:id/stats` and `/metrics`). A v3 would likely change these.
  Failure is graceful — counters disappear, builds pass — so watch for
  `[analytics]` warnings in the build log rather than a red build.
- **Astro `astro:build:done` hook** used by the glyph-coverage reporter.
- **Keystatic + OAuth in production.** Two upstream issues to expect on first
  deploy: Keystatic sends `redirect_uri` during authorisation but omits it at
  token exchange, which GitHub rejects (works locally, fails in production with a
  localhost redirect); and the GitHub App callback URL must match the production
  URL exactly, because the platform proxies requests and the app sees an internal
  hostname. Search the Keystatic issue tracker for the patch rather than
  rewriting the auth flow. If it cannot be made to work in reasonable time, fall
  back to Keystatic Cloud (free up to 3 users, and editors then need no GitHub
  account) — do not leave a broken admin.

## Admin auth

`src/middleware.ts` — Astro middleware, so it runs inside the app on any host and
can be tested. `scripts/check-middleware.mjs` boots the real built server and
asserts the whole matrix: no credentials, wrong password, wrong username, a
malformed header, correct credentials, and the fail-closed 503 when
`ADMIN_USER`/`ADMIN_PASSWORD` are unset.

This replaced platform middleware that could not be exercised by `pnpm check` at
all, and which therefore carried a standing "verify by hand after every deploy"
warning. That warning is gone.

## Not in scope

No CMS, newsletter, comments, search, related posts, tag cloud, sidebar or
categories grid. No i18n routing — the codebase is structured so `uz`/`en`/`ru`
could be added later, but no plumbing exists and Uzbek ships alone.

No medical or specialty iconography, eye graphics or clinical styling.
Ophthalmology is mentioned **once**, in one sentence on the homepage.
