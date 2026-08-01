/**
 * Flow state that survives a restart.
 *
 * A post is composed over many messages, and a deploy can restart the bot at any
 * moment in the middle of that. Losing a half-written post is the failure this
 * whole system exists to avoid, so every step is written to disk as it happens
 * rather than held in memory and flushed at the end.
 *
 * One JSON file per user, written atomically (temp file + rename) so a crash
 * mid-write leaves the previous state intact rather than a truncated file.
 *
 * State lives OUTSIDE the repository working copy: it holds message drafts and
 * Telegram ids, and none of that belongs in a content commit.
 */
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export class Store {
  /** @param {string} dir */
  constructor(dir) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  #file(userId) {
    if (!Number.isInteger(userId)) throw new Error(`bad user id: ${userId}`);
    return join(this.dir, `flow-${userId}.json`);
  }

  /** @returns {object|null} the user's in-progress flow, or null */
  get(userId) {
    try {
      return JSON.parse(readFileSync(this.#file(userId), 'utf8'));
    } catch {
      return null;
    }
  }

  /** Replaces the whole flow. */
  set(userId, flow) {
    const file = this.#file(userId);
    const temp = `${file}.tmp`;
    writeFileSync(temp, JSON.stringify({ ...flow, updatedAt: new Date().toISOString() }, null, 2));
    renameSync(temp, file);
    return flow;
  }

  /** Shallow-merges into the existing flow, creating it if absent. */
  patch(userId, changes) {
    return this.set(userId, { ...(this.get(userId) ?? {}), ...changes });
  }

  /** Appends to an array field — the multi-message body is the reason this exists. */
  push(userId, field, item) {
    const flow = this.get(userId) ?? {};
    const list = Array.isArray(flow[field]) ? flow[field] : [];
    return this.set(userId, { ...flow, [field]: [...list, item] });
  }

  clear(userId) {
    rmSync(this.#file(userId), { force: true });
  }

  /** Every user with an unfinished flow — used to report on startup. */
  pending() {
    try {
      return readdirSync(this.dir)
        .filter((name) => /^flow-\d+\.json$/.test(name))
        .map((name) => Number(name.slice(5, -5)));
    } catch {
      return [];
    }
  }
}

/**
 * getUpdates offset, kept next to the flows.
 *
 * Without persisting this, a restart re-delivers everything Telegram still holds
 * and the bot replays commands she already sent.
 */
export class Offset {
  constructor(dir) {
    this.file = join(dir, 'offset.json');
    mkdirSync(dir, { recursive: true });
  }

  read() {
    try {
      const { offset } = JSON.parse(readFileSync(this.file, 'utf8'));
      return Number.isInteger(offset) ? offset : 0;
    } catch {
      return 0;
    }
  }

  write(offset) {
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify({ offset }));
    renameSync(temp, this.file);
  }
}
