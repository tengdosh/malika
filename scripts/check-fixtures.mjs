#!/usr/bin/env node
/**
 * Proves the guardrails still bite. A check that has quietly stopped failing is
 * worse than no check, because it reads as a passing grade.
 *
 * Each fixture introduces a real defect, asserts the relevant check FAILS, then
 * removes it. Nothing is left behind, even if a case throws.
 *
 *   1. Uzbek lint  fails on a straight apostrophe in Uzbek text
 *   2. Glyph check fails on a font face lacking U+02BB
 *   3. Content schema fails when a koz-sogligi post has no sources
 *   4. Content schema fails when a cover image has no coverAlt
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  copyFileSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyseGlyphCoverage as analyse } from './lib/glyph-coverage.mjs';
import { resolveDistDir } from './lib/browser.mjs';

let failures = 0;
const cleanups = [];

/** Run a command; return true if it exited non-zero (i.e. the check caught it). */
function fails(command, args) {
  try {
    execFileSync(command, args, { stdio: 'pipe', encoding: 'utf8' });
    return false;
  } catch {
    return true;
  }
}

function expectFailure(name, didFail) {
  if (didFail) {
    console.log(`  ok   ${name}`);
  } else {
    console.error(`  FAIL ${name} — the check PASSED on a defect it must catch`);
    failures += 1;
  }
}

try {
  // 1 — Uzbek lint must reject a straight apostrophe.
  {
    const dir = mkdtempSync(join(tmpdir(), 'uzbek-fixture-'));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

    writeFileSync(join(dir, 'bad.md'), '---\ntitle: Test\n---\n\nBugun ko\'p o\'qidim va so\'ng uxladim.\n');
    writeFileSync(join(dir, 'good.md'), '---\ntitle: Test\n---\n\nBugun koʻp oʻqidim va soʻng uxladim.\n');

    expectFailure(
      'uzbek lint rejects a straight apostrophe',
      fails('node', ['scripts/check-uzbek.mjs', join(dir, 'bad.md')]),
    );
    expectFailure(
      'uzbek lint accepts U+02BB (control: must NOT fail)',
      !fails('node', ['scripts/check-uzbek.mjs', join(dir, 'good.md')]),
    );
  }

  // 2 — Glyph check must reject a face without U+02BB.
  //     Caveat is a real font that genuinely lacks it; copying it under a
  //     non-caveat name defeats the exemption and exercises the real code path.
  {
    const dir = mkdtempSync(join(tmpdir(), 'glyph-fixture-'));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    mkdirSync(join(dir, 'suspect'), { recursive: true });

    copyFileSync(
      'node_modules/@fontsource-variable/caveat/files/caveat-latin-wght-normal.woff2',
      join(dir, 'suspect', 'display-latin-wght-normal.woff2'),
    );

    expectFailure(
      'glyph check rejects a font lacking U+02BB',
      fails('node', ['scripts/check-glyphs.mjs', dir]),
    );
    expectFailure(
      'glyph check accepts the shipped fonts (control: must NOT fail)',
      !fails('node', ['scripts/check-glyphs.mjs', 'public/fonts']),
    );
  }

  // 2b — A post in exactly the shape Keystatic writes must build, and the image
  //      it uploaded must still go through astro:assets. This is the fiddliest
  //      part of Keystatic + Astro: `publicPath` has to stay relative to the
  //      content file or the image ships unoptimised, or not at all.
  {
    const post = 'src/content/posts/zz-fixture-cms.md';
    const image = 'src/assets/posts/zz-fixture-cms.jpg';
    copyFileSync('src/assets/posts/navbatchilikdan-keyin.jpg', image);
    cleanups.push(() => rmSync(image, { force: true }));

    // Empty optionals written the way a CMS writes them: null and ''.
    writeFileSync(
      post,
      [
        '---',
        'title: Admin orqali yozilgan',
        'description: Keystatic yozadigan shaklda saqlangan yozuv.',
        'pillar: kundalik',
        'date: 2026-08-01',
        'updated: null',
        'draft: false',
        'featured: false',
        'evergreen: false',
        'cover: ../../assets/posts/zz-fixture-cms.jpg',
        'coverAlt: Sinov uchun rasm',
        'sources: []',
        "reviewedBy: ''",
        '---',
        '',
        'Matn.',
        '',
      ].join('\n'),
    );
    cleanups.push(() => rmSync(post, { force: true }));

    let built = true;
    try {
      execFileSync('pnpm', ['exec', 'astro', 'build'], { stdio: 'pipe' });
    } catch {
      built = false;
    }
    expectFailure('a post in Keystatic output format BUILDS', built);

    if (built) {
      const html = readFileSync(
        `${resolveDistDir()}/yozuvlar/zz-fixture-cms/index.html`,
        'utf8',
      );
      expectFailure(
        'its uploaded image is optimised by astro:assets',
        /\.avif/.test(html) && /\.webp/.test(html) && /srcset=/.test(html),
        'avif + webp + srcset',
      );
      expectFailure(
        "Keystatic's empty values (null, '') do not break the schema",
        html.includes('Admin orqali yozilgan'),
      );
    }

    rmSync(post, { force: true });
    rmSync(image, { force: true });
  }

  // 2c — altQueries must never reach visible text.
  //      Injecting search variants into the body (or a hidden div) is cloaking,
  //      and on a YMYL health page it does real damage. A nonsense token proves
  //      it: any occurrence outside meta[name=keywords] would have to be ours.
  {
    const post = 'src/content/posts/zz-fixture-altq.md';
    const TOKEN = 'zzqvariantzz';
    writeFileSync(
      post,
      [
        '---',
        'title: Altqueries sinovi',
        'description: Qidiruv variantlari koʻrinadigan matnga tushmasligi kerak.',
        'pillar: kundalik',
        'date: 2026-08-01',
        'altQueries:',
        `  - ${TOKEN}`,
        '  - koz oldida chivin',
        '---',
        '',
        'Matn.',
        '',
      ].join('\n'),
    );
    cleanups.push(() => rmSync(post, { force: true }));

    let built = true;
    try {
      execFileSync('pnpm', ['exec', 'astro', 'build'], { stdio: 'pipe' });
    } catch {
      built = false;
    }
    expectFailure('a post with altQueries builds', built);

    if (built) {
      const html = readFileSync(`${resolveDistDir()}/yozuvlar/zz-fixture-altq/index.html`, 'utf8');
      const inKeywords = new RegExp(
        `<meta[^>]+name="keywords"[^>]+content="[^"]*${TOKEN}[^"]*"`,
      ).test(html);
      expectFailure('altQueries reach meta[name=keywords]', inKeywords);

      // Strip the head, then look for the token anywhere a reader could see it.
      const body = html.slice(html.indexOf('<body'));
      expectFailure(
        'altQueries appear in NO visible body text',
        !body.includes(TOKEN),
        'no cloaking',
      );
      expectFailure(
        'the page ships no hidden-text container',
        !/(display:\s*none|visibility:\s*hidden|text-indent:\s*-)/i.test(body),
      );
    }

    rmSync(post, { force: true });
  }

  // 3 — Coverage split: content warns and ships, UI strings fail.
  //     This is the rule that matters most operationally — Malika writes on a
  //     phone, and a character she typed must never stop a deploy.
  {
    const post = 'src/content/posts/__fixture-glyphs.md';
    writeFileSync(
      post,
      [
        '---',
        'title: Fixture — telefondan yozilgan',
        'description: Ellipsis, tire, qoʻshtirnoq, strelka va emoji bilan.',
        'pillar: kundalik',
        'date: 2026-07-30',
        '---',
        '',
        'Bugun charchadim… lekin yaxshi kun edi — rostdan ham.',
        '',
        'U menga «rahmat» dedi. Keyin qarasam: kitob → stol → oyna. 🙂',
        '',
      ].join('\n'),
    );
    cleanups.push(() => rmSync(post, { force: true }));

    expectFailure(
      'a post with …, —, «», → and an emoji still BUILDS',
      !fails('pnpm', ['exec', 'astro', 'build']),
    );
    expectFailure(
      'those characters warn but do NOT fail the glyph check',
      !fails('node', ['scripts/check-glyphs.mjs']),
    );

    const report = analyse();
    expectFailure(
      'the uncovered content characters are reported as warnings',
      report.warnings.length > 0 && report.failures.length === 0,
      `${report.warnings.length} warning(s), ${report.failures.length} error(s)`,
    );

    rmSync(post, { force: true });

    // Same characters, but authored in a .astro UI string — must fail.
    // NOT underscore-prefixed: Astro excludes those from file-based routing, so
    // an _-named fixture page would never be built and the assertion would pass
    // vacuously.
    const page = 'src/pages/zz-fixture-glyphs.astro';
    writeFileSync(
      page,
      [
        '---',
        "import Base from '../layouts/Base.astro';",
        '---',
        '',
        '<Base title="Fixture" noindex>',
        '  <div class="shell page-head">',
        '    <h1>Fixture</h1>',
        '    <p>kitob \u2192 stol</p>',
        '  </div>',
        '</Base>',
        '',
      ].join('\n'),
    );
    cleanups.push(() => rmSync(page, { force: true }));

    execFileSync('pnpm', ['exec', 'astro', 'build'], { stdio: 'pipe' });
    expectFailure(
      'the same character in a .astro UI string FAILS the glyph check',
      fails('node', ['scripts/check-glyphs.mjs']),
    );

    rmSync(page, { force: true });
  }

  // 3 & 4 — Schema refinements, exercised end to end through a real build.
  //         Asserting the predicate in isolation would not prove it is wired in.
  const schemaCases = [
    {
      name: 'sogliq collection rejects a post with no sources',
      file: 'src/content/posts/sogliq/__fixture-no-sources.md',
      body: [
        '---',
        'title: Fixture — manbasiz',
        'description: Bu yozuv manbasiz, shuning uchun build yiqilishi kerak.',
        'date: 2026-07-30',
        '---',
        '',
        'Matn.',
        '',
      ].join('\n'),
    },
    {
      // Backstop only: no CMS collection offers koz-sogligi as a pillar, so this
      // is unreachable through the admin. It still guards hand-edited files.
      name: 'backstop: a hand-written koz-sogligi post with no sources is rejected',
      file: 'src/content/posts/__fixture-no-sources-hand.md',
      body: [
        '---',
        'title: Fixture — qoʻlda yozilgan, manbasiz',
        'description: Adminda bunday qilib boʻlmaydi; qoʻlda yozilgan fayl uchun himoya.',
        'pillar: koz-sogligi',
        'date: 2026-07-30',
        '---',
        '',
        'Matn.',
        '',
      ].join('\n'),
    },
  ];

  for (const testCase of schemaCases) {
    writeFileSync(testCase.file, testCase.body);
    cleanups.push(() => rmSync(testCase.file, { force: true }));

    expectFailure(testCase.name, fails('pnpm', ['exec', 'astro', 'build']));

    rmSync(testCase.file, { force: true });
  }

  // 5 — coverAlt: withhold the image, do NOT fail the build.
  //     The opposite of a schema rule, and deliberately so: this failure is
  //     visible to Malika without anyone reading a log — she opens the post, the
  //     photo is missing, and she fixes it. A build failure would be invisible.
  {
    const post = 'src/content/posts/zz-fixture-noalt.md';
    const image = 'src/assets/posts/zz-fixture-noalt.jpg';
    copyFileSync('src/assets/posts/navbatchilikdan-keyin.jpg', image);
    cleanups.push(() => rmSync(image, { force: true }));

    writeFileSync(
      post,
      [
        '---',
        'title: Altsiz muqova',
        'description: Rasm bor, tavsif yoʻq — build yiqilmasligi kerak.',
        'pillar: kundalik',
        'date: 2026-08-01',
        'cover: ../../assets/posts/zz-fixture-noalt.jpg',
        '---',
        '',
        'Matn.',
        '',
      ].join('\n'),
    );
    cleanups.push(() => rmSync(post, { force: true }));

    // spawnSync, not execFileSync: the warning is written to stderr, and
    // execFileSync only returns stdout.
    const run = spawnSync('pnpm', ['exec', 'astro', 'build'], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    const built = run.status === 0;
    const log = `${run.stdout ?? ''}${run.stderr ?? ''}`;

    expectFailure('a cover with no alt text does NOT fail the build', built);

    if (built) {
      const html = readFileSync(
        `${resolveDistDir()}/yozuvlar/zz-fixture-noalt/index.html`,
        'utf8',
      );
      expectFailure(
        'the post still renders',
        html.includes('Altsiz muqova'),
      );
      expectFailure(
        'the image is withheld rather than shipped without alt',
        !html.includes('zz-fixture-noalt') || !/<img[^>]*alt=""/.test(html),
        'no alt="" image',
      );
      expectFailure(
        'a warning names the entry in the build log',
        log.includes('[cover]') && log.includes('zz-fixture-noalt'),
      );
    }

    rmSync(post, { force: true });
    rmSync(image, { force: true });
  }
} finally {
  cleanups.forEach((fn) => fn());
  // Leave dist/ consistent with the real content after the fixture builds.
  try {
    execFileSync('pnpm', ['exec', 'astro', 'build'], { stdio: 'pipe' });
  } catch {
    console.error('  warning: rebuild after fixtures failed — run `pnpm build` manually');
  }
}

if (failures > 0) {
  console.error(`\ncheck-fixtures: ${failures} guardrail(s) no longer catch their defect.`);
  process.exit(1);
}
console.log('\ncheck-fixtures: all guardrails still bite.');
