/**
 * The conversation flows.
 *
 * Every multi-step flow is a small state machine whose state lives on disk, not
 * in memory: a deploy can restart this process between any two messages, and a
 * half-written post must survive that. Each handler reads the flow, does one
 * step, and writes it back.
 *
 * The honest split with the CMS is enforced here rather than described: the bot
 * captures, publishes, swaps photos and fixes lines. Restructuring a long essay
 * and managing a sources list hand off to Keystatic with a deep link, because a
 * paragraph editor in a chat window would be worse than a link.
 */
import { readFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'glob';

import { PILLARS, PILLAR_LABEL } from '../../src/lib/pillars.ts';
import { normalizeUzbek } from '../../scripts/lib/normalize-uzbek.mjs';
import { entitiesToMarkdown, joinParagraphs } from './entities.mjs';
import { assetsDir, coverPath, readEntry, SINGLETONS, writeEntry } from './entry.mjs';
import { pickImage, saveCover } from './images.mjs';
import { keyboard } from './telegram.mjs';
import { slugify, uniqueSlug } from './slug.mjs';
import { B, T } from './text.mjs';

const HEALTH_PILLAR = 'koz-sogligi';

/** Which Keystatic collection an entry belongs to, for the deep link. */
const COLLECTION = { post: 'posts', sogliq: 'sogliq', note: 'notes' };

const cmsLink = (config, kind, slug) =>
  `${config.origin.replace(/\/$/, '')}/keystatic/collection/${COLLECTION[kind]}/item/${slug}`;

/* ------------------------------------------------------------- entry listing */

const KIND_OF_DIR = {
  'src/content/posts': 'post',
  'src/content/posts/sogliq': 'sogliq',
  'src/content/notes': 'note',
};

const field = (frontmatter, name) => {
  const match = new RegExp(`^${name}:\\s*(.*)$`, 'm').exec(frontmatter);
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : undefined;
};

/** Every entry on disk, newest first. */
export function listEntries(root) {
  const files = [
    ...globSync('src/content/posts/*.{md,mdx}', { cwd: root }),
    ...globSync('src/content/posts/sogliq/*.{md,mdx}', { cwd: root }),
    ...globSync('src/content/notes/*.{md,mdx}', { cwd: root }),
  ];

  return files
    .map((file) => {
      const text = readFileSync(join(root, file), 'utf8');
      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
      const dir = file.slice(0, file.lastIndexOf('/'));
      return {
        file,
        slug: file.replace(/.*\//, '').replace(/\.(md|mdx)$/, ''),
        kind: KIND_OF_DIR[dir] ?? 'post',
        title: field(frontmatter, 'title') ?? '(sarlavhasiz)',
        draft: field(frontmatter, 'draft') === 'true',
        date: field(frontmatter, 'date') ?? '',
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* -------------------------------------------------------------- git plumbing */

/**
 * Writes, commits and pushes — and never loses her work when the push fails.
 * The reply is the caller's, so each flow can phrase its own success line.
 */
/**
 * Optional deploy hook.
 *
 * Without it the bot still works and still says the site updates shortly —
 * something else (a timer, a webhook) is then responsible for making that true.
 * With it, the loop closes: she gets a second message naming the live URL, which
 * is what stops the re-submitting that uncertainty causes.
 *
 * The command comes from the environment, never from a message, which is why
 * running it through a shell is safe here.
 */
async function runRebuild(ctx) {
  const { config, telegram, chatId, log } = ctx;
  if (!config.rebuildCommand) return;

  const { execFile } = await import('node:child_process');
  execFile('/bin/sh', ['-c', config.rebuildCommand], { cwd: config.repoDir, timeout: 10 * 60_000 }, (error) => {
    if (error) {
      log(`rebuild failed: ${error.message}`);
      return;
    }
    telegram
      .sendMessage(chatId, `Sayt yangilandi: ${config.origin.replace(/\/$/, '')}`)
      .catch(() => {});
  });
}

async function commitAndPush(ctx, { paths, title }) {
  const { repo, telegram, chatId, log } = ctx;

  const { committed } = await repo.commit(paths, title);
  if (!committed) return { ok: true, changed: false };

  const result = await repo.push();
  if (result.pushed) {
    // Deliberately not awaited: a build takes minutes and the conversation must
    // not stall behind it.
    void runRebuild(ctx);
    return { ok: true, changed: true };
  }

  log(`push failed (${result.reason}): ${result.detail}`);
  await telegram.sendMessage(
    chatId,
    result.reason === 'conflict' ? T.pushFailedConflict : T.pushFailedOffline,
  );
  return { ok: false, changed: true };
}

/* ------------------------------------------------------------------- /yoz */

async function startYoz(ctx) {
  ctx.store.set(ctx.userId, { command: 'yoz', step: 'pillar', bodyChunks: [], sources: [] });
  await ctx.telegram.sendMessage(
    ctx.chatId,
    T.pickPillar,
    keyboard(PILLARS.map((slug) => [PILLAR_LABEL[slug], `pillar:${slug}`]), 2),
  );
}

async function askSourceOrCover(ctx, flow) {
  if (flow.kind === 'sogliq') {
    ctx.store.patch(ctx.userId, { step: 'source-title' });
    await ctx.telegram.sendMessage(ctx.chatId, `${T.sourcesIntro}\n\n${T.askSourceTitle}`);
    return;
  }
  ctx.store.patch(ctx.userId, { step: 'cover' });
  await ctx.telegram.sendMessage(ctx.chatId, T.askCover);
}

/** Renders exactly what will be committed, so the preview cannot lie. */
function previewOf(flow) {
  const body = joinParagraphs(flow.bodyChunks ?? []);
  const preview = normalizeUzbek(`${flow.title}\n\n${flow.description}\n\n${body}`);
  return preview;
}

async function showPreview(ctx, flow) {
  ctx.store.patch(ctx.userId, { step: 'preview' });
  await ctx.telegram.sendMessage(ctx.chatId, `${T.previewHeading}\n\n${previewOf(flow)}`);
  await ctx.telegram.sendMessage(
    ctx.chatId,
    T.previewSlug(flow.slug),
    keyboard(
      [
        [B.publish, 'yoz:publish'],
        [B.saveDraft, 'yoz:draft'],
        [B.cancel, 'yoz:cancel'],
      ],
      1,
    ),
  );
}

async function saveYoz(ctx, flow, { draft }) {
  const { config, repo, telegram, chatId, userId } = ctx;

  try {
    await repo.sync();
  } catch (error) {
    ctx.log(`sync failed: ${error.message}`);
  }

  // The slug was reserved when she typed the title; if the CMS has taken it
  // since, move to a free one and bring the cover file with it.
  const taken = new Set(listEntries(config.repoDir).map((entry) => entry.slug));
  let slug = flow.slug;
  if (taken.has(slug)) {
    slug = uniqueSlug(flow.title, (candidate) => taken.has(candidate));
    if (flow.coverFile) {
      const next = flow.coverFile.replace(/[^/]+(\.[^.]+)$/, `${slug}$1`);
      renameSync(join(config.repoDir, flow.coverFile), join(config.repoDir, next));
      flow.coverFile = next;
    }
  }

  const paths = [];
  const written = writeEntry(
    {
      slug,
      title: flow.title,
      description: flow.description,
      ...(flow.kind === 'sogliq' ? {} : { pillar: flow.pillar }),
      date: new Date(),
      draft,
      body: joinParagraphs(flow.bodyChunks ?? []),
      ...(flow.coverFile
        ? { cover: coverPath(flow.kind, flow.coverFile.replace(/.*\//, '')), coverAlt: flow.coverAlt }
        : {}),
      ...(flow.sources?.length ? { sources: flow.sources } : {}),
    },
    { kind: flow.kind, root: config.repoDir },
  );

  paths.push(written.file);
  if (flow.coverFile) paths.push(flow.coverFile);

  const result = await commitAndPush(ctx, { paths, title: flow.title });
  ctx.store.clear(userId);

  if (result.ok) {
    await telegram.sendMessage(
      chatId,
      `${draft ? T.savedDraft : T.published}\n${draft ? '' : T.deployNote}`.trim(),
    );
  }
}

/* ---------------------------------------------------------------- commands */

const COMMANDS = {
  '/yordam': async (ctx) => ctx.telegram.sendMessage(ctx.chatId, T.help),
  '/start': async (ctx) => ctx.telegram.sendMessage(ctx.chatId, T.help),

  '/bekor': async (ctx) => {
    const had = Boolean(ctx.store.get(ctx.userId));
    ctx.store.clear(ctx.userId);
    await ctx.telegram.sendMessage(ctx.chatId, had ? T.cancelled : T.nothingToCancel);
  },

  '/yoz': startYoz,

  '/hozir': async (ctx) => {
    ctx.store.set(ctx.userId, { command: 'hozir', step: 'text' });
    await ctx.telegram.sendMessage(ctx.chatId, T.askHozir);
  },

  '/kitob': async (ctx) => {
    ctx.store.set(ctx.userId, { command: 'kitob', step: 'text' });
    await ctx.telegram.sendMessage(ctx.chatId, T.askKitob);
  },

  '/qoralama': async (ctx) => {
    const drafts = listEntries(ctx.config.repoDir).filter((entry) => entry.draft);
    if (!drafts.length) {
      await ctx.telegram.sendMessage(ctx.chatId, T.noDrafts);
      return;
    }
    ctx.store.set(ctx.userId, { command: 'qoralama', step: 'pick' });
    await ctx.telegram.sendMessage(
      ctx.chatId,
      T.pickDraft,
      keyboard(drafts.slice(0, 10).map((d) => [d.title.slice(0, 40), `draft:${d.slug}`]), 1),
    );
  },

  '/tahrir': async (ctx) => {
    const entries = listEntries(ctx.config.repoDir).slice(0, 10);
    if (!entries.length) {
      await ctx.telegram.sendMessage(ctx.chatId, T.noPosts);
      return;
    }
    ctx.store.set(ctx.userId, { command: 'tahrir', step: 'pick' });
    await ctx.telegram.sendMessage(
      ctx.chatId,
      T.pickPost,
      keyboard(
        entries.map((e) => [`${e.draft ? '○ ' : ''}${e.title}`.slice(0, 40), `edit:${e.slug}`]),
        1,
      ),
    );
  },

  '/statistika': async (ctx) => {
    const { analyticsConfigured, getAnalyticsSnapshot } = await import(
      '../../src/lib/analytics/index.ts'
    );

    if (!analyticsConfigured()) {
      await ctx.telegram.sendMessage(ctx.chatId, T.statsUnconfigured);
      return;
    }

    const snapshot = await getAnalyticsSnapshot();
    if (!snapshot) {
      await ctx.telegram.sendMessage(ctx.chatId, T.statsUnavailable);
      return;
    }

    await ctx.telegram.sendMessage(ctx.chatId, formatStats(snapshot, ctx.config));
  },
};

/** One readable message: two windows, top posts, top referrers. */
export function formatStats(snapshot, config) {
  const lines = [];
  const window = (label, totals) =>
    totals ? `${label}: ${totals.visits} tashrif, ${totals.pageviews} koʻrish` : null;

  lines.push(window('7 kun', snapshot.last7), window('30 kun', snapshot.last30));

  if (snapshot.pages?.length) {
    lines.push('', 'Eng koʻp oʻqilgani:');
    for (const page of snapshot.pages.slice(0, 5)) {
      lines.push(`  ${page.pageviews} — ${page.path}`);
    }
  }

  if (snapshot.referrers?.length) {
    lines.push('', 'Qayerdan kelishgan:');
    for (const referrer of snapshot.referrers.slice(0, 5)) {
      lines.push(`  ${referrer.count} — ${referrer.name}`);
    }
  }

  lines.push('', `Toʻliq koʻrinish: ${config.origin.replace(/\/$/, '')}/admin/statistika`);
  return lines.filter((line) => line !== null).join('\n');
}

/* ----------------------------------------------------------- message router */

export async function onMessage(ctx, message) {
  const text = message.text ?? message.caption ?? '';
  const command = /^\/([a-z_]+)/.exec(text)?.[0];

  if (command && COMMANDS[command]) {
    await COMMANDS[command](ctx);
    return;
  }

  const flow = ctx.store.get(ctx.userId);
  if (!flow) {
    await ctx.telegram.sendMessage(ctx.chatId, T.unknown);
    return;
  }

  await stepFlow(ctx, flow, message, text, command);
}

async function stepFlow(ctx, flow, message, text, command) {
  const { telegram, chatId, userId, store, config } = ctx;
  const markdown = () => entitiesToMarkdown(text, message.entities ?? message.caption_entities ?? []);

  switch (`${flow.command}:${flow.step}`) {
    /* ---- /yoz */
    case 'yoz:title': {
      const title = text.trim();
      if (!title) return;
      const taken = new Set(listEntries(config.repoDir).map((entry) => entry.slug));
      store.patch(userId, {
        title,
        slug: uniqueSlug(title, (candidate) => taken.has(candidate)),
        step: 'description',
      });
      await telegram.sendMessage(chatId, T.askDescription);
      return;
    }

    case 'yoz:description': {
      const description = text.trim();
      if (description.length > 200) {
        await telegram.sendMessage(chatId, T.descriptionTooLong(description.length));
        return;
      }
      store.patch(userId, { description, step: 'body' });
      await telegram.sendMessage(chatId, T.askBody);
      return;
    }

    case 'yoz:body': {
      if (command === '/tugadi') {
        const current = store.get(userId);
        if (!current.bodyChunks?.length) {
          await telegram.sendMessage(chatId, T.bodyEmpty);
          return;
        }
        await askSourceOrCover(ctx, current);
        return;
      }
      if (!text.trim()) return;
      const updated = store.push(userId, 'bodyChunks', markdown());
      await telegram.sendMessage(chatId, T.bodyAdded(updated.bodyChunks.length));
      return;
    }

    /* ---- sources, health posts only */
    case 'yoz:source-title': {
      if (command === '/otkaz') {
        await telegram.sendMessage(chatId, T.sourceNeeded);
        return;
      }
      store.patch(userId, { sourceDraft: { title: text.trim() }, step: 'source-publisher' });
      await telegram.sendMessage(chatId, T.askSourcePublisher);
      return;
    }

    case 'yoz:source-publisher': {
      store.patch(userId, {
        sourceDraft: { ...flow.sourceDraft, publisher: text.trim() },
        step: 'source-year',
      });
      await telegram.sendMessage(chatId, T.askSourceYear);
      return;
    }

    case 'yoz:source-year': {
      const year = command === '/otkaz' ? undefined : Number.parseInt(text, 10);
      store.patch(userId, {
        sourceDraft: { ...flow.sourceDraft, ...(Number.isInteger(year) ? { year } : {}) },
        step: 'source-url',
      });
      await telegram.sendMessage(chatId, T.askSourceUrl);
      return;
    }

    case 'yoz:source-url': {
      const url = command === '/otkaz' ? undefined : text.trim();
      const source = { ...flow.sourceDraft, ...(url ? { url } : {}) };
      const updated = store.set(userId, {
        ...flow,
        sources: [...(flow.sources ?? []), source],
        sourceDraft: undefined,
        step: 'sources-more',
      });
      await telegram.sendMessage(
        chatId,
        T.moreSources,
        keyboard([[B.yes, 'src:more'], [B.no, 'src:done']], 2),
      );
      void updated;
      return;
    }

    /* ---- cover */
    case 'yoz:cover': {
      if (command === '/otkaz') {
        await showPreview(ctx, store.patch(userId, { step: 'preview' }));
        return;
      }
      const image = pickImage(message);
      if (!image) return;

      const saved = await saveCover({
        telegram,
        image,
        slug: flow.slug,
        root: config.repoDir,
        maxBytes: config.maxImageBytes,
      });
      if (!saved.ok) {
        await telegram.sendMessage(chatId, saved.message);
        return;
      }

      const next = store.patch(userId, { coverFile: saved.relative, step: 'coverAlt' });
      if (saved.soft && !flow.softHintShown) {
        store.patch(userId, { softHintShown: true });
        await telegram.sendMessage(chatId, T.softHint);
      }
      await telegram.sendMessage(chatId, `${T.coverSaved}\n\n${T.askCoverAlt}`);
      void next;
      return;
    }

    case 'yoz:coverAlt': {
      const updated = store.patch(userId, { coverAlt: text.trim(), step: 'preview' });
      await showPreview(ctx, updated);
      return;
    }

    /* ---- /hozir */
    case 'hozir:text': {
      await updateSingleton(ctx, 'strip', markdown().trim());
      store.clear(userId);
      return;
    }

    /* ---- /kitob */
    case 'kitob:text': {
      await updateBook(ctx, text.trim());
      store.clear(userId);
      return;
    }

    /* ---- /tahrir sub-steps */
    case 'tahrir:title': {
      await patchEntryField(ctx, flow, 'title', text.trim());
      store.clear(userId);
      return;
    }

    case 'tahrir:description': {
      if (text.trim().length > 200) {
        await telegram.sendMessage(chatId, T.descriptionTooLong(text.trim().length));
        return;
      }
      await patchEntryField(ctx, flow, 'description', text.trim());
      store.clear(userId);
      return;
    }

    case 'tahrir:append':
    case 'tahrir:replace': {
      if (command === '/tugadi') {
        const current = store.get(userId);
        await applyBodyEdit(ctx, current, current.step === 'append');
        store.clear(userId);
        return;
      }
      if (!text.trim()) return;
      const updated = store.push(userId, 'bodyChunks', markdown());
      await telegram.sendMessage(chatId, T.bodyAdded(updated.bodyChunks.length));
      return;
    }

    case 'tahrir:cover': {
      const image = pickImage(message);
      if (!image) return;
      const saved = await saveCover({
        telegram,
        image,
        slug: flow.slug,
        root: config.repoDir,
        maxBytes: config.maxImageBytes,
      });
      if (!saved.ok) {
        await telegram.sendMessage(chatId, saved.message);
        return;
      }
      store.patch(userId, { coverFile: saved.relative, step: 'coverAlt' });
      if (saved.soft) await telegram.sendMessage(chatId, T.softHint);
      await telegram.sendMessage(chatId, `${T.coverSaved}\n\n${T.askCoverAlt}`);
      return;
    }

    case 'tahrir:coverAlt': {
      const current = store.get(userId);
      await patchEntryCover(ctx, current, current.coverFile, text.trim());
      store.clear(userId);
      return;
    }

    default:
      await telegram.sendMessage(chatId, T.unknown);
  }
}

/* ------------------------------------------------------- callback handling */

export async function onCallback(ctx, query) {
  const { telegram, store, userId, chatId } = ctx;
  const data = String(query.data ?? '');
  await telegram.answerCallbackQuery(query.id);

  const flow = store.get(userId);

  if (data.startsWith('pillar:')) {
    const pillar = data.slice('pillar:'.length);
    const kind = pillar === HEALTH_PILLAR ? 'sogliq' : 'post';
    store.patch(userId, { pillar, kind, step: 'title' });
    await telegram.sendMessage(chatId, T.askTitle);
    return;
  }

  if (data === 'src:more') {
    store.patch(userId, { step: 'source-title' });
    await telegram.sendMessage(chatId, T.askSourceTitle);
    return;
  }

  if (data === 'src:done') {
    store.patch(userId, { step: 'cover' });
    await telegram.sendMessage(chatId, T.askCover);
    return;
  }

  if (data === 'yoz:publish' || data === 'yoz:draft') {
    if (!flow) return;
    await saveYoz(ctx, flow, { draft: data === 'yoz:draft' });
    return;
  }

  if (data === 'yoz:cancel') {
    store.clear(userId);
    await telegram.sendMessage(chatId, T.cancelled);
    return;
  }

  if (data.startsWith('draft:')) {
    await publishExisting(ctx, data.slice('draft:'.length));
    store.clear(userId);
    return;
  }

  if (data.startsWith('edit:')) {
    const slug = data.slice('edit:'.length);
    const entry = listEntries(ctx.config.repoDir).find((item) => item.slug === slug);
    if (!entry) return;
    store.set(userId, { command: 'tahrir', slug, kind: entry.kind, file: entry.file, step: 'menu', bodyChunks: [] });
    await telegram.sendMessage(
      chatId,
      T.pickAction,
      keyboard(
        [
          [B.changeTitle, 'act:title'],
          [B.changeDescription, 'act:description'],
          [B.appendBody, 'act:append'],
          [B.replaceBody, 'act:replace'],
          [B.changeCover, 'act:cover'],
          [B.removeCover, 'act:removecover'],
          [B.toggleDraft, 'act:toggledraft'],
          [B.openCms, 'act:cms'],
        ],
        2,
      ),
    );
    return;
  }

  if (data.startsWith('act:') && flow) {
    await onEditAction(ctx, flow, data.slice('act:'.length));
  }
}

async function onEditAction(ctx, flow, action) {
  const { telegram, chatId, store, config } = ctx;

  switch (action) {
    case 'title':
      store.patch(ctx.userId, { step: 'title' });
      return telegram.sendMessage(chatId, T.askNewTitle);
    case 'description':
      store.patch(ctx.userId, { step: 'description' });
      return telegram.sendMessage(chatId, T.askNewDescription);
    case 'append':
      store.patch(ctx.userId, { step: 'append', bodyChunks: [] });
      return telegram.sendMessage(chatId, T.askAppend);
    case 'replace':
      store.patch(ctx.userId, { step: 'replace', bodyChunks: [] });
      return telegram.sendMessage(chatId, T.askReplaceBody);
    case 'cover':
      store.patch(ctx.userId, { step: 'cover' });
      return telegram.sendMessage(chatId, T.askCover);
    case 'removecover':
      await patchEntryCover(ctx, flow, null, null);
      store.clear(ctx.userId);
      return telegram.sendMessage(chatId, T.coverRemoved);
    case 'toggledraft':
      await toggleDraft(ctx, flow);
      store.clear(ctx.userId);
      return undefined;
    case 'cms':
      store.clear(ctx.userId);
      return telegram.sendMessage(
        chatId,
        `${T.cmsOnly}\n${cmsLink(config, flow.kind, flow.slug)}`,
      );
    default:
      return undefined;
  }
}

/* --------------------------------------------------------- entry mutations */

/** Rewrites one frontmatter field in place, leaving the body untouched. */
function replaceField(text, name, rendered) {
  const line = new RegExp(`^${name}:.*$`, 'm');
  if (line.test(text)) return text.replace(line, `${name}: ${rendered}`);
  return text.replace(/^---\n/, `---\n${name}: ${rendered}\n`);
}

async function writeAndPush(ctx, file, text, title, extraPaths = []) {
  const { config } = ctx;
  try {
    await ctx.repo.sync();
  } catch (error) {
    ctx.log(`sync failed: ${error.message}`);
  }
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(config.repoDir, file), normalizeUzbek(text));
  return commitAndPush(ctx, { paths: [file, ...extraPaths], title });
}

async function patchEntryField(ctx, flow, name, value) {
  const raw = readFileSync(join(ctx.config.repoDir, flow.file), 'utf8');
  const quoted = /[:#'"]|^\s|\s$/.test(value) ? `'${value.replace(/'/g, "''")}'` : value;
  const result = await writeAndPush(ctx, flow.file, replaceField(raw, name, quoted), value);
  if (result.ok) await ctx.telegram.sendMessage(ctx.chatId, `${T.hozirSaved}\n${T.deployNote}`);
}

async function applyBodyEdit(ctx, flow, append) {
  const { body, frontmatter } = readEntry(flow.file, ctx.config.repoDir);
  const addition = joinParagraphs(flow.bodyChunks ?? []);
  const next = append ? `${body.trimEnd()}\n\n${addition}` : addition;
  const text = `---\n${frontmatter}\n---\n\n${next.trim()}\n`;
  const result = await writeAndPush(ctx, flow.file, text, flow.slug);
  if (result.ok) await ctx.telegram.sendMessage(ctx.chatId, `${T.hozirSaved}\n${T.deployNote}`);
}

async function patchEntryCover(ctx, flow, coverFile, alt) {
  const raw = readFileSync(join(ctx.config.repoDir, flow.file), 'utf8');
  let text = raw;

  if (coverFile) {
    const value = coverPath(flow.kind, coverFile.replace(/.*\//, ''));
    text = replaceField(text, 'cover', value);
    text = replaceField(text, 'coverAlt', alt ? `'${alt.replace(/'/g, "''")}'` : "''");
  } else {
    // Clearing the field, not deleting the image: a mis-tap must not destroy a
    // photo, and the file stays where it is so the cover can be put back.
    text = text.replace(/^cover:.*$\n?/m, '').replace(/^coverAlt:.*$\n?/m, '');
  }

  const result = await writeAndPush(ctx, flow.file, text, flow.slug, coverFile ? [coverFile] : []);
  if (result.ok && coverFile) {
    await ctx.telegram.sendMessage(ctx.chatId, `${T.coverSaved}\n${T.deployNote}`);
  }
}

async function toggleDraft(ctx, flow) {
  const raw = readFileSync(join(ctx.config.repoDir, flow.file), 'utf8');
  const isDraft = /^draft:\s*true\s*$/m.test(raw);
  const text = replaceField(raw, 'draft', isDraft ? 'false' : 'true');
  const result = await writeAndPush(ctx, flow.file, text, flow.slug);
  if (result.ok) {
    await ctx.telegram.sendMessage(
      ctx.chatId,
      `${isDraft ? T.publishedAgain : T.draftedAgain}\n${T.deployNote}`,
    );
  }
}

async function publishExisting(ctx, slug) {
  const entry = listEntries(ctx.config.repoDir).find((item) => item.slug === slug);
  if (!entry) return;
  const raw = readFileSync(join(ctx.config.repoDir, entry.file), 'utf8');
  const result = await writeAndPush(ctx, entry.file, replaceField(raw, 'draft', 'false'), entry.title);
  if (result.ok) {
    await ctx.telegram.sendMessage(ctx.chatId, `${T.published}\n${T.deployNote}`);
  }
}

/* ------------------------------------------------------------- singletons */

async function updateSingleton(ctx, fieldName, value) {
  const file = SINGLETONS.hozir;
  const raw = readFileSync(join(ctx.config.repoDir, file), 'utf8');
  const quoted = `'${value.replace(/'/g, "''")}'`;
  const result = await writeAndPush(ctx, file, replaceField(raw, fieldName, quoted), 'Hozir');
  if (result.ok) await ctx.telegram.sendMessage(ctx.chatId, `${T.hozirSaved}\n${T.deployNote}`);
}

/** A bare number is progress; anything else is the one-line note. */
async function updateBook(ctx, input) {
  const file = SINGLETONS.oqiyapman;
  const path = join(ctx.config.repoDir, file);
  if (!existsSync(path)) {
    await ctx.telegram.sendMessage(ctx.chatId, T.kitobNoBook);
    return;
  }

  const raw = readFileSync(path, 'utf8');
  if (!/^\s*book:/m.test(raw)) {
    await ctx.telegram.sendMessage(ctx.chatId, T.kitobNoBook);
    return;
  }

  const asNumber = /^\d{1,3}$/.test(input) ? Number(input) : null;
  let text;
  let reply;

  if (asNumber !== null && asNumber >= 0 && asNumber <= 100) {
    text = raw.replace(/^(\s*)progress:.*$/m, `$1progress: ${asNumber}`);
    reply = T.kitobProgress(asNumber);
  } else {
    text = raw.replace(/^(\s*)note:.*$/m, `$1note: '${input.replace(/'/g, "''")}'`);
    reply = T.kitobNote;
  }

  const result = await writeAndPush(ctx, file, text, 'Hozir oʻqiyapman');
  if (result.ok) await ctx.telegram.sendMessage(ctx.chatId, `${reply}\n${T.deployNote}`);
}

export { cmsLink, previewOf };
