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

Two rules are enforced by the build, not by review. **Do not weaken either.**

- A `koz-sogligi` post with no `sources` **fails the build.** No unsourced health
  claim can ship, even by accident.
- A `cover` with no `coverAlt` **fails the build.**

`scripts/check-fixtures.mjs` re-proves both on every CI run, by writing a
deliberately broken post and asserting the build rejects it.

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

`src/content/site/men-haqimda.md` is the `/men-haqimda` body and holds the hero
portrait. It currently has two `TODO(bio)` markers — institution and graduation
year — which are deliberately unfilled.

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
summary line and any warnings appear in the Vercel/Cloudflare build log, not
only in `pnpm check`. A warning nobody sees in CI is a warning nobody sees.

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
Vercel and Cloudflare both do. Measuring against uncompressed HTML inflated FCP
by ~700ms — an artefact of the harness, not the site.

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

## Deployment

Static output, no adapter — portable between Vercel and Cloudflare Pages.

```
pnpm build   # → dist/
```

**Canonical origin is `https://malika-bobonazarova.uz`.** Every other hostname
must 301 to it at the edge:

- **Vercel** — `vercel.json` (`redirects`, host-matched on `www.`)
- **Cloudflare Pages** — `public/_redirects`

Both also ship `Cache-Control: immutable` for `/fonts/*` and `/_astro/*`, plus
`nosniff`, `Referrer-Policy` and HSTS.

Add the apex domain **and** `www` in the host's dashboard, pointing both at this
project — the redirect rules only fire for hostnames the host actually serves.

### Analytics

Cookieless and off by default. Set `PUBLIC_ANALYTICS_DOMAIN` in the host's
environment to enable it in production builds only; dev and CI never load it. See
`.env.example`. `PUBLIC_ANALYTICS_SRC` switches Plausible for a self-hosted Umami.

No visitor personal data is stored anywhere, which keeps the site clear of
Uzbekistan's sensitive-data localisation rules and makes foreign hosting
straightforward. `/maxfiylik` ships from day one and describes exactly this.

### Social handles

`SOCIAL.telegram` and `SOCIAL.instagram` in `src/lib/site.js` are **unset**. The
site builds and deploys without them: the Telegram CTA, the footer social link
and the `/maxfiylik` contact line each render nothing, and `sameAs` is omitted
from `Person` JSON-LD rather than emitted empty — a guessed or empty `sameAs` is
worse than none, because it can associate her with a stranger's account. Set the
two constants when real handles exist; nothing else needs changing.

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

## Not in scope

No CMS, newsletter, comments, search, related posts, tag cloud, sidebar or
categories grid. No i18n routing — the codebase is structured so `uz`/`en`/`ru`
could be added later, but no plumbing exists and Uzbek ships alone.

No medical or specialty iconography, eye graphics or clinical styling.
Ophthalmology is mentioned **once**, in one sentence on the homepage.
