/**
 * Configuration, and the allowlist.
 *
 * The bot has write access to the repository, so who may talk to it is the most
 * important thing in this file.
 *
 *  - **Numeric Telegram user IDs only.** A username can be changed by its owner
 *    and re-registered by someone else; the numeric id cannot. Matching on
 *    @username would mean anyone who takes an abandoned handle inherits write
 *    access to Malika's blog.
 *  - **Fail closed.** With TELEGRAM_ALLOWED_IDS unset the bot serves nobody. The
 *    opposite default — unset means everyone — is the kind of mistake that is
 *    only discovered from the commit log.
 *  - **Silence, not refusal.** A stranger gets no reply at all, only a log line.
 *    A "you are not allowed" message confirms the bot exists and is worth
 *    probing; silence is indistinguishable from a dead token.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Loads a .env next to the bot if one exists. Node ≥20.12 has this built in. */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  try {
    process.loadEnvFile(path);
  } catch {
    // An unreadable or malformed .env must not take the bot down silently —
    // the missing-token error below is the clearer failure.
  }
}

const value = (name) => {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? undefined : raw;
};

/**
 * Parses TELEGRAM_ALLOWED_IDS.
 *
 * Anything that is not a positive integer is dropped and reported: a typo like
 * `@malika` silently becoming "allow nobody" is safe, but it should be loud.
 *
 * @param {string|undefined} raw
 * @returns {{ ids: Set<number>, rejected: string[] }}
 */
export function parseAllowlist(raw) {
  const ids = new Set();
  const rejected = [];

  for (const part of String(raw ?? '').split(',')) {
    const token = part.trim();
    if (!token) continue;
    if (/^\d+$/.test(token)) ids.add(Number(token));
    else rejected.push(token);
  }

  return { ids, rejected };
}

export function loadConfig(env = process.env) {
  loadEnvFile(resolve(process.cwd(), 'bot/.env'));
  loadEnvFile(resolve(process.cwd(), '.env'));

  const { ids, rejected } = parseAllowlist(env.TELEGRAM_ALLOWED_IDS ?? value('TELEGRAM_ALLOWED_IDS'));

  return {
    token: env.TELEGRAM_BOT_TOKEN ?? value('TELEGRAM_BOT_TOKEN'),
    allowed: ids,
    rejectedAllowlistEntries: rejected,

    /** The working copy the bot commits into. */
    repoDir: resolve(env.BOT_REPO_DIR ?? value('BOT_REPO_DIR') ?? process.cwd()),
    /** Flow state lives outside the repo so it is never committed. */
    stateDir: resolve(env.BOT_STATE_DIR ?? value('BOT_STATE_DIR') ?? '.bot-state'),

    origin: env.SITE_ORIGIN ?? value('SITE_ORIGIN') ?? 'https://malika-bobonazarova.uz',

    /** Optional: a command run after a successful push, e.g. scripts/rebuild.sh. */
    rebuildCommand: env.BOT_REBUILD_COMMAND ?? value('BOT_REBUILD_COMMAND'),

    /** Largest cover the build should be asked to process. */
    maxImageBytes: Number(env.BOT_MAX_IMAGE_BYTES ?? value('BOT_MAX_IMAGE_BYTES') ?? 12 * 1024 * 1024),
  };
}

/**
 * The only authorisation decision in the bot.
 *
 * @param {{ allowed: Set<number> }} config
 * @param {number|undefined} userId
 */
export const isAllowed = (config, userId) =>
  typeof userId === 'number' && Number.isInteger(userId) && config.allowed.has(userId);

/**
 * Refuses to start on a configuration that would be unsafe or useless.
 * Returns the list of problems rather than throwing, so the caller can log all
 * of them at once.
 */
export function configProblems(config) {
  const problems = [];
  if (!config.token) problems.push('TELEGRAM_BOT_TOKEN is not set');
  if (config.allowed.size === 0) {
    problems.push(
      'TELEGRAM_ALLOWED_IDS is empty — refusing to start rather than serving everyone',
    );
  }
  for (const bad of config.rejectedAllowlistEntries) {
    problems.push(`TELEGRAM_ALLOWED_IDS entry ${JSON.stringify(bad)} is not a numeric id`);
  }
  return problems;
}
