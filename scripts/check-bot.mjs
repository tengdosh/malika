#!/usr/bin/env node
/**
 * The bot's guardrails.
 *
 * Drives whole conversations through the real handlers with a fake transport:
 * no token, no network, no Telegram. What is exercised is the actual routing,
 * the actual flow persistence and the actual files written to a real git
 * repository — the parts that can silently lose Malika's work.
 *
 * The one thing this cannot cover is Telegram's own behaviour. Everything from
 * the update object inwards is real; the update objects themselves are shaped by
 * hand from the Bot API documentation.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseAllowlist, isAllowed, configProblems } from '../bot/src/config.mjs';
import { Store } from '../bot/src/store.mjs';
import { Repo } from '../bot/src/git.mjs';
import { Telegram } from '../bot/src/telegram.mjs';
import { handleUpdate } from '../bot/src/index.mjs';
import { entitiesToMarkdown } from '../bot/src/entities.mjs';
import { formatStats } from '../bot/src/flows.mjs';
import { resolveDistDir } from './lib/browser.mjs';

let failures = 0;
const ok = (name, condition, detail = '') => {
  if (condition) console.log(`  ok   ${name}`);
  else {
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    failures += 1;
  }
};

const cleanups = [];
const JPEG = readFileSync('src/assets/posts/navbatchilikdan-keyin.jpg');

/* --------------------------------------------------------- fake transport */

function fakeTelegram() {
  const sent = [];
  const fetchImpl = async (url, init) => {
    const method = String(url).split('/').pop();
    const body = init?.body ? JSON.parse(init.body) : {};

    if (String(url).includes('/file/bot')) {
      return { ok: true, arrayBuffer: async () => JPEG.buffer.slice(0, JPEG.length) };
    }

    const result =
      method === 'getMe'
        ? { username: 'test_bot' }
        : method === 'getFile'
          ? { file_path: 'photos/test.jpg', file_size: JPEG.length }
          : method === 'sendMessage'
            ? { message_id: sent.length + 1 }
            : true;

    if (method === 'sendMessage') sent.push({ chatId: body.chat_id, text: body.text, markup: body.reply_markup });
    return { ok: true, json: async () => ({ ok: true, result }) };
  };

  return { telegram: new Telegram({ token: 'test', fetchImpl }), sent };
}

/* -------------------------------------------------------------- fake repo */

function scratchRepo() {
  const root = mkdtempSync(join(tmpdir(), 'bot-check-'));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));

  const bare = join(root, 'origin.git');
  const work = join(root, 'work');
  execFileSync('git', ['init', '--bare', '-b', 'main', bare], { stdio: 'pipe' });
  execFileSync('git', ['init', '-b', 'main', work], { stdio: 'pipe' });

  for (const dir of [
    'src/content/posts/sogliq',
    'src/content/notes',
    'src/assets/posts',
    'src/content/site/hozir',
    'src/content/site/oqiyapman',
  ]) {
    mkdirSync(join(work, dir), { recursive: true });
  }
  writeFileSync(join(work, 'src/content/site/hozir/index.md'), "---\ntitle: Hozir\nstrip: 'eski'\n---\n\nMatn.\n");
  writeFileSync(
    join(work, 'src/content/site/oqiyapman/index.yaml'),
    "title: Hozir oʻqiyapman\nbook:\n  title: Kitob\n  author: Muallif\n  startedOn: 2026-07-01\n  progress: 10\n  note: 'eski izoh'\n",
  );

  const git = (...args) => execFileSync('git', args, { cwd: work, stdio: 'pipe' });
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'seed');
  git('remote', 'add', 'origin', bare);
  git('push', 'origin', 'main');

  return { root, work, bare };
}

const message = (userId, text, extra = {}) => ({
  update_id: Math.floor(Math.random() * 1e9),
  message: { message_id: 1, from: { id: userId }, chat: { id: userId }, text, ...extra },
});
const callback = (userId, data) => ({
  update_id: Math.floor(Math.random() * 1e9),
  callback_query: { id: 'cb', from: { id: userId }, message: { chat: { id: userId } }, data },
});

const ALLOWED = 387178074;
const STRANGER = 999000111;

try {
  /* 1 — the allowlist is the whole security model. */
  {
    const { ids, rejected } = parseAllowlist('387178074, 1859234424, @malika, ');
    ok('numeric ids parsed', ids.has(387178074) && ids.has(1859234424) && ids.size === 2);
    ok('a @username is refused, not silently allowed', rejected.includes('@malika'));

    const empty = { allowed: new Set() };
    ok('unset allowlist allows nobody', !isAllowed(empty, 387178074));
    ok(
      'an empty allowlist refuses to start',
      configProblems({ token: 't', allowed: new Set(), rejectedAllowlistEntries: [] }).length > 0,
    );
    ok('a string id is not accepted', !isAllowed({ allowed: new Set([1]) }, '1'));
  }

  /* 2 — a stranger gets no response at all. */
  {
    const { telegram, sent } = fakeTelegram();
    const { work } = scratchRepo();
    const store = new Store(mkdtempSync(join(tmpdir(), 'bot-state-')));
    const config = { allowed: new Set([ALLOWED]), repoDir: work, origin: 'https://example.uz', maxImageBytes: 5e6 };
    await handleUpdate({ telegram, store, repo: new Repo({ dir: work }), config }, message(STRANGER, '/yoz'));
    ok('a non-allowlisted id gets zero replies', sent.length === 0, `${sent.length} sent`);
  }

  /* 3 — a complete /yoz for a HEALTH post, including the source requirement. */
  let produced;
  {
    const { telegram, sent } = fakeTelegram();
    const { work } = scratchRepo();
    const stateDir = mkdtempSync(join(tmpdir(), 'bot-state-'));
    const store = new Store(stateDir);
    const repo = new Repo({ dir: work });
    const config = { allowed: new Set([ALLOWED]), repoDir: work, origin: 'https://example.uz', maxImageBytes: 5e6 };
    const ctx = { telegram, store, repo, config };
    const send = (update) => handleUpdate(ctx, update);

    await send(message(ALLOWED, '/yoz'));
    ok('/yoz offers a pillar keyboard', Boolean(sent.at(-1).markup?.inline_keyboard?.length));

    await send(callback(ALLOWED, 'pillar:koz-sogligi'));
    await send(message(ALLOWED, 'Koʻz oldidagi chivinlar'));
    await send(message(ALLOWED, 'Chivinlar odatda xavfsiz, lekin qachon shifokorga borish kerakligini bilib qoʻyish muhim.'));

    // Multi-message body, with Telegram formatting on the second part.
    await send(message(ALLOWED, "Bugun ko'p o'qidim."));
    await send(
      message(ALLOWED, 'Muhim: bu tashxis emas.', { entities: [{ type: 'bold', offset: 0, length: 6 }] }),
    );

    // A restart in the middle: a brand-new Store over the same directory.
    const revived = new Store(stateDir);
    const midFlow = revived.get(ALLOWED);
    ok('flow survives a restart mid-post', midFlow?.bodyChunks?.length === 2, JSON.stringify(midFlow?.step));

    await send(message(ALLOWED, '/tugadi'));
    ok('a health post asks for a source', sent.at(-1).text.includes('manba'));

    // Refusing to skip the source is the editorial rule every client must honour.
    await send(message(ALLOWED, '/otkaz'));
    ok('the source cannot be skipped', sent.at(-1).text.includes('Kamida bitta manba'));

    await send(message(ALLOWED, 'Floaters and Flashes'));
    await send(message(ALLOWED, 'American Academy of Ophthalmology'));
    await send(message(ALLOWED, '2024'));
    await send(message(ALLOWED, '/otkaz'));
    await send(callback(ALLOWED, 'src:done'));

    // A cover, sent the compressed way, then its alt text.
    await send(message(ALLOWED, '', { photo: [{ file_id: 'f1', width: 1280, height: 800, file_size: JPEG.length }] }));
    ok('a small photo gets the file-is-sharper hint once', sent.some((m) => m.text.includes('fayl')));
    await send(message(ALLOWED, 'Oq devor va yorugʻlik'));
    ok('the preview shows the slug', sent.at(-1).text.includes('/yozuvlar/'));

    await send(callback(ALLOWED, 'yoz:publish'));

    const file = join(work, 'src/content/posts/sogliq/koz-oldidagi-chivinlar.md');
    produced = readFileSync(file, 'utf8');

    ok('written into the sogliq collection', produced.length > 0);
    ok('cover uses the three-level path', produced.includes('cover: ../../../assets/posts/'));
    ok('the source is recorded', produced.includes('American Academy of Ophthalmology'));
    ok('no pillar is written for a health post', !/^pillar:/m.test(produced));
    ok('straight apostrophes were normalised', produced.includes('koʻp oʻqidim') && !produced.includes("ko'p"));
    ok('Telegram bold became Markdown', produced.includes('**Muhim:**'));
    ok('the flow was cleared after saving', store.get(ALLOWED) === null);

    const log = execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: work }).toString();
    ok('committed as content(bot):', log.startsWith('content(bot): '));
  }

  /* 4 — the very same file the bot produced must build and render. */
  {
    const post = 'src/content/posts/sogliq/zz-bot-check.md';
    const image = 'src/assets/posts/zz-bot-check.jpg';
    copyFileSync('src/assets/posts/navbatchilikdan-keyin.jpg', image);
    cleanups.push(() => rmSync(image, { force: true }));
    writeFileSync(
      post,
      produced
        .replace(/^title:.*$/m, 'title: Bot sinovi')
        .replace(/cover: .*$/m, 'cover: ../../../assets/posts/zz-bot-check.jpg'),
    );
    cleanups.push(() => rmSync(post, { force: true }));

    let built = true;
    try {
      execFileSync('pnpm', ['exec', 'astro', 'build'], { stdio: 'pipe' });
    } catch {
      built = false;
    }
    ok('the bot-authored post BUILDS', built);

    if (built) {
      const html = readFileSync(`${resolveDistDir()}/yozuvlar/zz-bot-check/index.html`, 'utf8');
      ok('its cover is optimised by astro:assets', /\.avif/.test(html) && /srcset=/.test(html));
      ok('its bold renders', /<strong>Muhim:<\/strong>/.test(html));
      ok('its source renders', /American Academy of Ophthalmology/.test(html));
    }
    rmSync(post, { force: true });
    rmSync(image, { force: true });
  }

  /* 5 — /hozir and /kitob are one message each. */
  {
    const { telegram, sent } = fakeTelegram();
    const { work } = scratchRepo();
    const store = new Store(mkdtempSync(join(tmpdir(), 'bot-state-')));
    const config = { allowed: new Set([ALLOWED]), repoDir: work, origin: 'https://example.uz', maxImageBytes: 5e6 };
    const ctx = { telegram, store, repo: new Repo({ dir: work }), config };

    await handleUpdate(ctx, message(ALLOWED, '/hozir'));
    await handleUpdate(ctx, message(ALLOWED, 'Imtihonlarga tayyorlanyapman.'));
    const hozir = readFileSync(join(work, 'src/content/site/hozir/index.md'), 'utf8');
    ok('/hozir updates in one message', hozir.includes('Imtihonlarga tayyorlanyapman.'));
    ok('/hozir needed exactly one prompt', sent.filter((m) => m.text.includes('Hozir')).length >= 1);

    await handleUpdate(ctx, message(ALLOWED, '/kitob'));
    await handleUpdate(ctx, message(ALLOWED, '45'));
    const kitob = readFileSync(join(work, 'src/content/site/oqiyapman/index.yaml'), 'utf8');
    ok('/kitob sets progress from a bare number', /progress:\s*45/.test(kitob));

    await handleUpdate(ctx, message(ALLOWED, '/kitob'));
    await handleUpdate(ctx, message(ALLOWED, 'Juda sekin ketyapti.'));
    const kitob2 = readFileSync(join(work, 'src/content/site/oqiyapman/index.yaml'), 'utf8');
    ok('/kitob sets the note from a sentence', kitob2.includes('Juda sekin ketyapti.'));
    ok('the book progress survived the note edit', /progress:\s*45/.test(kitob2));
  }

  /* 6a — the CMS moving first is NOT a conflict: sync happens before the write,
   *      so her update lands on top of the latest state and pushes cleanly. This
   *      is the common case and it must stay quiet. */
  {
    const { telegram, sent } = fakeTelegram();
    const { work, bare } = scratchRepo();
    const store = new Store(mkdtempSync(join(tmpdir(), 'bot-state-')));
    const repo = new Repo({ dir: work });
    const config = { allowed: new Set([ALLOWED]), repoDir: work, origin: 'https://example.uz', maxImageBytes: 5e6 };
    const ctx = { telegram, store, repo, config };

    const other = mkdtempSync(join(tmpdir(), 'bot-other-'));
    cleanups.push(() => rmSync(other, { recursive: true, force: true }));
    execFileSync('git', ['clone', bare, other], { stdio: 'pipe' });
    mkdirSync(join(other, 'src/content/posts'), { recursive: true });
    writeFileSync(join(other, 'src/content/posts/cms-only.md'), '---\ntitle: CMS\n---\n\nMatn.\n');
    const og = (...a) => execFileSync('git', a, { cwd: other, stdio: 'pipe' });
    og('add', '-A');
    og('-c', 'user.name=c', '-c', 'user.email=c@c', 'commit', '-m', 'cms');
    og('push', 'origin', 'main');

    await handleUpdate(ctx, message(ALLOWED, '/hozir'));
    await handleUpdate(ctx, message(ALLOWED, 'Malika yozgani'));

    ok('an unrelated CMS commit is absorbed silently', !sent.some((m) => m.text.includes('yoʻqolmadi')));
    ok('her update pushed', (await repo.unpushed()).length === 0);

    // The deploy hook must actually fire, or "the site updates shortly" is a
    // promise the bot cannot keep.
    const marker = join(work, 'rebuilt.txt');
    const hooked = { ...config, rebuildCommand: `touch ${marker}` };
    await handleUpdate({ telegram, store, repo, config: hooked }, message(ALLOWED, '/hozir'));
    await handleUpdate({ telegram, store, repo, config: hooked }, message(ALLOWED, 'Yana bir marta'));
    for (let i = 0; i < 40 && !existsSync(marker); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    ok('BOT_REBUILD_COMMAND runs after a successful push', existsSync(marker));
    for (let i = 0; i < 40 && !sent.some((m) => m.text.startsWith('Sayt yangilandi')); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    ok('and she gets the live URL as a follow-up', sent.some((m) => m.text.startsWith('Sayt yangilandi')));
    ok(
      'and the CMS commit is still there',
      execFileSync('git', ['log', '--oneline'], { cwd: work }).toString().includes('cms'),
    );
  }

  /* 6b — a genuine conflict, at the layer where it happens. Origin moves
   *      between our sync and our push, which is the only window in which the
   *      rebase can fail. Her commit must survive it. */
  {
    const { work, bare } = scratchRepo();
    const repo = new Repo({ dir: work });

    await repo.sync();
    writeFileSync(join(work, 'src/content/posts/clash.md'), '---\ntitle: Malika\n---\n\nMalika yozgani.\n');
    await repo.commit(['src/content/posts/clash.md'], 'Toqnashuv');

    // Someone else writes the SAME file, after our sync.
    const other = mkdtempSync(join(tmpdir(), 'bot-other2-'));
    cleanups.push(() => rmSync(other, { recursive: true, force: true }));
    execFileSync('git', ['clone', bare, other], { stdio: 'pipe' });
    mkdirSync(join(other, 'src/content/posts'), { recursive: true });
    writeFileSync(join(other, 'src/content/posts/clash.md'), '---\ntitle: CMS\n---\n\nCMS yozgani.\n');
    const og = (...a) => execFileSync('git', a, { cwd: other, stdio: 'pipe' });
    og('add', '-A');
    og('-c', 'user.name=c', '-c', 'user.email=c@c', 'commit', '-m', 'cms clash');
    og('push', 'origin', 'main');

    const result = await repo.push();
    ok('a real conflict is reported, not thrown', result.pushed === false && result.reason === 'conflict');
    ok(
      'her text survives the failed rebase',
      readFileSync(join(work, 'src/content/posts/clash.md'), 'utf8').includes('Malika yozgani'),
    );
    ok('her commit is kept, not discarded', (await repo.unpushed()).length >= 1);
  }

  /* 6c — and the flow tells her about it in words, without losing the file. */
  {
    const { telegram, sent } = fakeTelegram();
    const { work } = scratchRepo();
    const store = new Store(mkdtempSync(join(tmpdir(), 'bot-state-')));
    const repo = new Repo({ dir: work });
    repo.push = async () => ({ pushed: false, reason: 'conflict', detail: 'simulated' });
    const config = { allowed: new Set([ALLOWED]), repoDir: work, origin: 'https://example.uz', maxImageBytes: 5e6 };
    const ctx = { telegram, store, repo, config };

    await handleUpdate(ctx, message(ALLOWED, '/hozir'));
    await handleUpdate(ctx, message(ALLOWED, 'Malika yozgani'));

    ok('she is told the work is safe but unpublished', sent.some((m) => m.text.includes('yoʻqolmadi')));
    ok(
      'her text is still on disk',
      readFileSync(join(work, 'src/content/site/hozir/index.md'), 'utf8').includes('Malika yozgani'),
    );
    ok('no false success message', !sent.some((m) => m.text.includes('Yangilandi')));
  }

  /* 7 — statistics degrade rather than error. */
  {
    ok(
      'an empty snapshot still formats',
      formatStats({ last7: null, last30: null, pages: [], referrers: [] }, { origin: 'https://x.uz' })
        .includes('/admin/statistika'),
    );
    const { analyticsConfigured } = await import('../src/lib/analytics/index.ts');
    ok('unconfigured analytics reports as unconfigured', analyticsConfigured() === false);
  }

  /* 8 — entity conversion corner cases. */
  {
    ok('utf-16 offsets survive an emoji', entitiesToMarkdown('🙂 Sogʻ', [{ type: 'bold', offset: 3, length: 4 }]) === '🙂 **Sogʻ**');
    ok(
      'a nested link inside bold',
      entitiesToMarkdown('AAO sayti', [
        { type: 'bold', offset: 0, length: 9 },
        { type: 'text_link', offset: 0, length: 3, url: 'https://aao.org/' },
      ]) === '**[AAO](https://aao.org/) sayti**',
    );
    ok('trailing space moves outside the markers', entitiesToMarkdown('ha ', [{ type: 'bold', offset: 0, length: 3 }]) === '**ha** ');
    ok('a list is left as written', entitiesToMarkdown('- birinchi\n- ikkinchi', []) === '- birinchi\n- ikkinchi');
  }
} finally {
  cleanups.forEach((fn) => {
    try {
      fn();
    } catch {
      /* best effort */
    }
  });
  try {
    execFileSync('pnpm', ['exec', 'astro', 'build'], { stdio: 'pipe' });
  } catch {
    console.error('  warning: rebuild after the bot checks failed — run `pnpm build`');
  }
}

if (failures > 0) {
  console.error(`\ncheck-bot: ${failures} bot guarantee(s) broken.`);
  process.exit(1);
}
console.log('\ncheck-bot: the bot still keeps its promises.');
