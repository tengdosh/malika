/**
 * Boots the built @astrojs/node standalone server for checks that need the real
 * request path — on-demand routes and middleware — rather than static files.
 *
 * This is what makes the admin auth testable at all. The Vercel/Cloudflare
 * middleware it replaced only ran on the platform, so it could not be exercised
 * by `pnpm build` or `pnpm check`; the README carried a standing warning to go
 * and verify it by hand after every deploy. That warning is now obsolete.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const ENTRY = 'dist/server/entry.mjs';

/**
 * @param {{ port?: number, env?: Record<string,string>, timeoutMs?: number }} options
 * @returns {Promise<{ origin: string, stop: () => void, log: () => string }>}
 */
export async function startNodeServer({ port = 4488, env = {}, timeoutMs = 25_000 } = {}) {
  if (!existsSync(ENTRY)) {
    throw new Error(`${ENTRY} not found — run \`pnpm build\` first.`);
  }

  const child = spawn(process.execPath, [ENTRY], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), ...env },
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });

  const origin = `http://127.0.0.1:${port}`;
  const stop = () => child.kill('SIGTERM');
  const deadline = Date.now() + timeoutMs;

  // Poll rather than parse the banner: the readiness line has changed between
  // adapter versions, a status code has not.
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early (${child.exitCode}):\n${output}`);
    }
    try {
      await fetch(origin + '/', { signal: AbortSignal.timeout(1500) });
      return { origin, stop, log: () => output };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  stop();
  throw new Error(`server did not start within ${timeoutMs}ms:\n${output}`);
}
