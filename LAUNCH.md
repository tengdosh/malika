# Launch checklist

Everything here must be true before the site is public. Nothing here is
optional, and the first item is the one that gets forgotten.

---

## 1. Turn indexing back on

**The site is currently `noindex`.** Every page carries
`<meta name="robots" content="noindex, nofollow">` while `PUBLIC_NOINDEX=1` is
set, because it has been serving under a non-canonical hostname.

- [ ] Unset `PUBLIC_NOINDEX` in the server's build environment
- [ ] Rebuild
- [ ] Confirm on a real page: `curl -s https://<origin>/ | grep -i 'name="robots"'` returns **nothing**
- [ ] Confirm `sitemap-index.xml` and `robots.txt` are reachable

Leaving this on is the classic launch failure: everything looks finished, and
the site is invisible for months with no error anywhere to explain it.

---

## 2. Replace the placeholders

Generated stand-ins are in the repo at the right dimensions. They are obviously
provisional up close, and not obviously provisional in a thumbnail.

- [ ] **Portrait** — `src/assets/about/portrait.jpg`, 3/4, 900×1200. Upload via
      *Men haqimda* in the admin.
- [ ] **Signature** — `src/components/Signature.astro` renders the word "Malika"
      in Caveat. Replace with an SVG scan of her handwriting, then delete Caveat
      from `scripts/font-manifest.mjs` and `--hand` from `tokens.css`.
- [ ] **Post covers** — `src/assets/posts/*.jpg`. All three placeholders are
      byte-identical, so they currently share one optimised OG image; real
      photos fix that automatically.
- [ ] **Book cover** — `src/assets/books/kitob.jpg`, 2/3.
- [ ] **Open Graph fallback** — `public/og-default.png`, 1200×630. Only used
      when a card fails to render, but it is the image that shows if it does.
- [ ] **Byline avatar** — `src/components/Byline.astro` renders the letter M.

See `src/assets/PLACEHOLDERS.md` for the full list and dimensions.

---

## 3. Fill in the real content

- [ ] **Social handles** in *Sozlamalar* — Telegram, and Instagram/email if they
      exist. Until Telegram is set the subscribe block does not render and
      `sameAs` is omitted from `Person` JSON-LD; both are correct empty states,
      but the block is worth having.
- [ ] **`footerBio`** in *Sozlamalar* — the one credential line under every post.
- [ ] **Institution and graduation year** in *Men haqimda* — both are editable
      fields and both are currently blank.
- [ ] Re-read the seeded posts. They were written as plausible drafts in her
      voice, not by her.

---

## 4. Analytics

- [ ] Umami instance reachable, website created
- [ ] `ANALYTICS_PROVIDER=umami`, `UMAMI_API_URL`, `UMAMI_WEBSITE_ID`, and either
      `UMAMI_API_KEY` or `UMAMI_USERNAME`/`UMAMI_PASSWORD` set at build time
- [ ] `PUBLIC_ANALYTICS_DOMAIN` set so the page tag loads
- [ ] After a rebuild, `/admin/statistika` shows real numbers rather than
      "Hozircha maʼlumot yoʻq"
- [ ] Decide `hisoblagichMinimum`. It ships at `0`; `50` once traffic exists is
      the recommendation — "3 marta oʻqildi" reads worse than no counter.

Nothing here blocks a launch. With analytics unconfigured the site works
normally and simply shows no view counts.

---

## 5. Confirm the admin is not public

Do this from a machine that has never authenticated, in a private window.

- [ ] `https://<origin>/admin/statistika` prompts for a password
- [ ] Wrong credentials are rejected
- [ ] `ADMIN_USER` and `ADMIN_PASSWORD` are set in the server's runtime
      environment — **if they are unset the route returns 503**, which is safe
      but means Malika cannot get in either
- [ ] The password is not the one from any fixture or example

`pnpm check` covers this logic (`scripts/check-middleware.mjs` boots the real
server and asserts the whole matrix), so this step is confirming the deployment,
not the code.

---

## 6. CMS

- [ ] GitHub App created; `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`,
      `KEYSTATIC_SECRET`, `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` set
- [ ] `PUBLIC_KEYSTATIC_STORAGE=github` and the repo owner/name variables set
- [ ] The App's callback URL matches the production URL exactly
- [ ] Malika can log in at `/keystatic`, save a post, and see it live after a
      rebuild
- [ ] Screenshots added to `docs/malika-uchun.md` at the marked places
- [ ] She has the admin URL, her login, and the stats password

Expect the two known upstream OAuth issues on first deploy — see README >
Upgrade risks.

---

## 7. Search engines

Only after step 1.

- [ ] Search Console property verified
- [ ] Yandex Webmaster verified
- [ ] Sitemap submitted to both
- [ ] `INDEXNOW_KEY` set, `/<key>.txt` reachable
- [ ] Share preview checked by pasting a real post link into Telegram

---

## 8. Last look

- [ ] `pnpm check` green
- [ ] A post with a cover and a post without both render well on a phone
- [ ] Dark mode, and text size at 125%
- [ ] The site reads like a person's blog, not a clinic
