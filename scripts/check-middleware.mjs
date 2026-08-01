#!/usr/bin/env node
/**
 * Admin auth, exercised against the real built server.
 *
 * The previous platform middleware could not be tested: it only ran on Vercel or
 * Cloudflare, so `pnpm check` proved nothing and the README carried a warning to
 * verify by hand after every deploy. Astro middleware runs inside the app, so it
 * can be covered here — which is the whole point of the move.
 *
 * Asserts:
 *   1. /admin/* demands credentials, and rejects wrong ones
 *   2. correct credentials get through
 *   3. it FAILS CLOSED — unset credentials return 503, never a public page
 *   4. public pages and the CMS are unaffected
 *   5. the admin response is never cached and never indexed
 */
import { startNodeServer } from './lib/node-server.mjs';

const ADMIN = '/admin/statistika';
const USER = 'malika';
const PASS = 'fixture-password-do-not-ship';
const basic = (u, p) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${name}${detail ? `  (${detail})` : ''}`);
  } else {
    console.error(`  FAIL ${name}${detail ? `  (${detail})` : ''}`);
    failures += 1;
  }
};

const get = (origin, path, headers = {}) =>
  fetch(origin + path, { headers, redirect: 'manual', signal: AbortSignal.timeout(20_000) });

// ------------------------------------------------- configured credentials
{
  const server = await startNodeServer({
    port: 4488,
    env: { ADMIN_USER: USER, ADMIN_PASSWORD: PASS },
  });
  try {
    const anonymous = await get(server.origin, ADMIN);
    check('no credentials -> 401', anonymous.status === 401, `got ${anonymous.status}`);
    check(
      'the 401 asks the browser for a password',
      /^Basic/i.test(anonymous.headers.get('www-authenticate') ?? ''),
      anonymous.headers.get('www-authenticate') ?? 'no header',
    );

    const wrongPassword = await get(server.origin, ADMIN, { authorization: basic(USER, 'nope') });
    check('wrong password -> 401', wrongPassword.status === 401, `got ${wrongPassword.status}`);

    const wrongUser = await get(server.origin, ADMIN, { authorization: basic('someone', PASS) });
    check('wrong username -> 401', wrongUser.status === 401, `got ${wrongUser.status}`);

    const malformed = await get(server.origin, ADMIN, { authorization: 'Basic !!!not-base64!!!' });
    check('malformed header -> 401, not a crash', malformed.status === 401, `got ${malformed.status}`);

    const authorised = await get(server.origin, ADMIN, { authorization: basic(USER, PASS) });
    check('correct credentials -> 200', authorised.status === 200, `got ${authorised.status}`);

    const body = await authorised.text();
    check('and the page really is the stats page', body.includes('Statistika'));
    check(
      'the admin response is never cached',
      (authorised.headers.get('cache-control') ?? '').includes('no-store'),
      authorised.headers.get('cache-control') ?? 'none',
    );
    check(
      'the admin response is never indexed',
      (authorised.headers.get('x-robots-tag') ?? '').includes('noindex'),
      authorised.headers.get('x-robots-tag') ?? 'none',
    );

    // The guard must not leak onto anything else.
    const home = await get(server.origin, '/');
    check('public pages are unaffected', home.status === 200, `/ -> ${home.status}`);
    const cms = await get(server.origin, '/keystatic');
    check('the CMS is unaffected', cms.status === 200, `/keystatic -> ${cms.status}`);
  } finally {
    server.stop();
  }
}

// ------------------------------------------------------------ fails closed
{
  const server = await startNodeServer({
    port: 4489,
    env: { ADMIN_USER: '', ADMIN_PASSWORD: '' },
  });
  try {
    const response = await get(server.origin, ADMIN);
    check(
      'unset credentials -> 503, NOT a public page',
      response.status === 503,
      `got ${response.status}`,
    );
    const home = await get(server.origin, '/');
    check('the rest of the site still serves', home.status === 200, `/ -> ${home.status}`);
  } finally {
    server.stop();
  }
}

if (failures > 0) {
  console.error(`\ncheck-middleware: ${failures} problem(s).`);
  process.exit(1);
}
console.log('\ncheck-middleware: the admin area is closed.');
