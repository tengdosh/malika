/**
 * Git, as the bot's second client onto the same repository Keystatic writes to.
 *
 * The rule that shapes every function here: **her work is never discarded.** A
 * failed push leaves the commit sitting in the local repository, and the bot
 * says so; it does not reset, it does not force, it does not rewrite history. A
 * post she just wrote is the most expensive thing this system holds.
 *
 * Every git invocation goes through execFile with an argument array. Nothing —
 * not a title, not a slug, not a filename — is ever interpolated into a shell
 * string.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export class GitError extends Error {
  constructor(message, { stdout = '', stderr = '' } = {}) {
    super(message);
    this.name = 'GitError';
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export class Repo {
  /**
   * @param {object} options
   * @param {string} options.dir working copy the bot commits into
   * @param {string} [options.branch]
   * @param {string} [options.authorName]
   * @param {string} [options.authorEmail]
   * @param {(message: string) => void} [options.log]
   */
  constructor({ dir, branch = 'main', authorName = 'Malika bot', authorEmail = 'bot@malika-bobonazarova.uz', log = () => {} }) {
    this.dir = dir;
    this.branch = branch;
    this.authorName = authorName;
    this.authorEmail = authorEmail;
    this.log = log;
  }

  /**
   * @param {string[]} args
   *
   * The identity is passed to EVERY invocation, not just `commit`. `rebase`
   * re-applies commits and needs a committer too — without it, a machine with no
   * global git config fails the rebase and the bot reports a content conflict
   * that never happened.
   */
  async git(args, { allowFailure = false } = {}) {
    const identity = [
      '-c',
      `user.name=${this.authorName}`,
      '-c',
      `user.email=${this.authorEmail}`,
    ];
    try {
      const { stdout, stderr } = await run('git', [...identity, ...args], {
        cwd: this.dir,
        maxBuffer: 8 * 1024 * 1024,
      });
      return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error) {
      const result = {
        ok: false,
        stdout: String(error.stdout ?? '').trim(),
        stderr: String(error.stderr ?? error.message).trim(),
      };
      if (allowFailure) return result;
      throw new GitError(`git ${args[0]} failed`, result);
    }
  }

  /** Paths with uncommitted changes, so the bot can refuse to bury someone else's edit. */
  async dirtyPaths() {
    const { stdout } = await this.git(['status', '--porcelain']);
    return stdout ? stdout.split('\n').map((line) => line.slice(3)) : [];
  }

  /**
   * Brings the working copy up to date before writing.
   *
   * The CMS may have touched the same file minutes ago; writing on top of a
   * stale checkout is how two clients silently overwrite each other.
   */
  async sync() {
    const fetched = await this.git(['fetch', 'origin', this.branch], { allowFailure: true });
    if (!fetched.ok) {
      // Offline is not fatal: she can still write, and the push will report.
      this.log(`fetch failed (continuing offline): ${fetched.stderr}`);
      return { fetched: false, rebased: false };
    }

    const rebase = await this.git(['rebase', `origin/${this.branch}`], { allowFailure: true });
    if (!rebase.ok) {
      await this.git(['rebase', '--abort'], { allowFailure: true });
      throw new GitError('local history conflicts with origin — resolve it by hand', rebase);
    }

    return { fetched: true, rebased: true };
  }

  /**
   * Stages the given paths and commits.
   *
   * @param {string[]} paths repo-relative
   * @param {string} title  used verbatim in the message, never through a shell
   */
  async commit(paths, title) {
    await this.git(['add', '--', ...paths]);

    const staged = await this.git(['diff', '--cached', '--name-only']);
    if (!staged.stdout) return { committed: false, sha: null };

    // Distinguishes bot writes from CMS writes in the history. The title is an
    // argv element, never part of a shell string.
    await this.git(['commit', '-m', `content(bot): ${title}`]);

    const { stdout: sha } = await this.git(['rev-parse', '--short', 'HEAD']);
    return { committed: true, sha };
  }

  /**
   * Pushes, retrying once through a rebase if origin moved underneath us.
   *
   * Returns rather than throws on a conflict the retry cannot fix: the caller
   * has to tell her plainly that the post is saved locally but not published,
   * and that is a message, not an exception.
   *
   * @returns {Promise<{ pushed: boolean, reason?: string, detail?: string }>}
   */
  async push() {
    const first = await this.git(['push', 'origin', `HEAD:${this.branch}`], { allowFailure: true });
    if (first.ok) return { pushed: true };

    this.log(`push rejected, retrying after rebase: ${first.stderr}`);

    const fetched = await this.git(['fetch', 'origin', this.branch], { allowFailure: true });
    if (!fetched.ok) {
      return { pushed: false, reason: 'offline', detail: fetched.stderr };
    }

    const rebase = await this.git(['rebase', `origin/${this.branch}`], { allowFailure: true });
    if (!rebase.ok) {
      // Leave the tree usable and the commit intact.
      await this.git(['rebase', '--abort'], { allowFailure: true });
      return { pushed: false, reason: 'conflict', detail: rebase.stdout || rebase.stderr };
    }

    const second = await this.git(['push', 'origin', `HEAD:${this.branch}`], { allowFailure: true });
    if (second.ok) return { pushed: true, retried: true };

    return { pushed: false, reason: 'rejected', detail: second.stderr };
  }

  /** Commits that exist locally but not on origin — i.e. work not yet published. */
  async unpushed() {
    const { stdout } = await this.git(
      ['log', '--oneline', `origin/${this.branch}..HEAD`],
      { allowFailure: true },
    );
    return stdout ? stdout.split('\n') : [];
  }
}
