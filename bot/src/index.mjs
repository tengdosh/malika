#!/usr/bin/env node
/**
 * The bot process.
 *
 * Long polling, one process, no public endpoint. It refuses to start on an
 * unsafe configuration rather than starting in a permissive one — the allowlist
 * being empty means "serve nobody", never "serve everyone".
 */
import { loadConfig, configProblems, isAllowed } from './config.mjs';
import { Offset, Store } from './store.mjs';
import { Repo } from './git.mjs';
import { Telegram } from './telegram.mjs';
import { onCallback, onMessage } from './flows.mjs';

/** Registered in Telegram's menu, so she never has to remember a command. */
export const COMMAND_MENU = [
  { command: 'yoz', description: 'Yangi yozuv' },
  { command: 'qoralama', description: 'Qoralamalar' },
  { command: 'tahrir', description: 'Yozuvni oʻzgartirish' },
  { command: 'hozir', description: '«Hozir» qatorini yangilash' },
  { command: 'kitob', description: '«Hozir oʻqiyapman»' },
  { command: 'statistika', description: 'Nechta odam oʻqidi' },
  { command: 'yordam', description: 'Yordam' },
  { command: 'bekor', description: 'Boshlangan ishni toʻxtatish' },
];

const stamp = () => new Date().toISOString();
const log = (message) => console.log(`[${stamp()}] ${message}`);

/**
 * Routes one update. Exported so the checks can drive whole flows without a
 * network or a token.
 */
export async function handleUpdate({ telegram, store, repo, config }, update) {
  const message = update.message;
  const callback = update.callback_query;

  const from = message?.from ?? callback?.from;
  const chat = message?.chat ?? callback?.message?.chat;
  const userId = from?.id;

  if (!isAllowed(config, userId)) {
    // No reply of any kind. A refusal confirms the bot is real and worth
    // probing; silence is indistinguishable from a dead token.
    log(`ignored update from ${userId ?? 'unknown'} (@${from?.username ?? '-'})`);
    return;
  }

  const ctx = { telegram, store, repo, config, userId, chatId: chat?.id, log };

  try {
    if (callback) await onCallback(ctx, callback);
    else if (message) await onMessage(ctx, message);
  } catch (error) {
    log(`handler failed: ${error.stack ?? error.message}`);
    // Her flow state is untouched, so nothing she typed is lost.
    if (chat?.id) {
      await telegram
        .sendMessage(chat.id, 'Nimadir xato ketdi. Yozganingiz saqlanib turibdi — qaytadan urinib koʻring.')
        .catch(() => {});
    }
  }
}

async function main() {
  const config = loadConfig();
  const problems = configProblems(config);

  if (problems.length) {
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('\nRefusing to start. See README > Telegram bot.');
    process.exit(1);
  }

  const telegram = new Telegram({ token: config.token, log });
  const store = new Store(config.stateDir);
  const offset = new Offset(config.stateDir);
  const repo = new Repo({ dir: config.repoDir, log });

  /*
   * Start-up talks to Telegram twice, and a machine that has just booted often
   * has no route yet. Without this the process exits on a transient timeout and
   * relies on the service manager to try again — which works, but turns a
   * two-second blip into a restart loop in the journal.
   */
  const withRetry = async (label, fn) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        if (attempt >= 5) throw error;
        const wait = Math.min(30, 2 ** attempt) * 1000;
        log(`${label} failed (${error.message}); retrying in ${wait / 1000}s`);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  };

  const me = await withRetry('getMe', () => telegram.getMe());
  log(`@${me.username} up; ${config.allowed.size} allowed id(s); repo ${config.repoDir}`);

  const pending = store.pending();
  if (pending.length) log(`resuming ${pending.length} unfinished flow(s): ${pending.join(', ')}`);

  await withRetry('setMyCommands', () => telegram.setMyCommands(COMMAND_MENU));

  let running = true;
  const stop = () => {
    running = false;
    log('shutting down');
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (running) {
    let updates = [];
    try {
      updates = await telegram.getUpdates(offset.read(), 50);
    } catch (error) {
      log(`getUpdates failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }

    for (const update of updates) {
      await handleUpdate({ telegram, store, repo, config }, update);
      // Written after each update, so a crash never replays work she has
      // already had applied.
      offset.write(update.update_id + 1);
    }
  }
}

// Only run when executed directly; importing this module must have no effect.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
