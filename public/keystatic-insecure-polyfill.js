/**
 * crypto.subtle.digest for an insecure origin.
 *
 * Browsers expose window.crypto.subtle only in a secure context — HTTPS, or
 * localhost. Keystatic hashes file contents in the browser to work out what has
 * changed (`crypto.subtle.digest('SHA-1', …)` for git blob ids, SHA-256
 * elsewhere), so over plain HTTP it throws
 *
 *     Cannot read properties of undefined (reading 'digest')
 *
 * and the editor hangs on a spinner forever.
 *
 * THIS IS A STOPGAP. The real fix is HTTPS: the certificate exists and nginx is
 * configured, and the site is served over HTTP only because the upstream proxy
 * does not forward 443 yet. When it does, this file stops being used the moment
 * the origin becomes secure — the guard below sees a real crypto.subtle and
 * leaves it alone.
 *
 * These digests are content hashes, not a security boundary: Keystatic uses them
 * to compare file versions. Nothing here protects anything, and nothing here
 * makes the connection any safer — the password still crosses the network in
 * clear text until HTTPS is on.
 */
(function () {
  'use strict';

  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    return; // Secure context: the real implementation is present.
  }

  /* ------------------------------------------------------------------ SHA-1 */

  function sha1(bytes) {
    const ml = bytes.length * 8;
    const withPadding = new Uint8Array(((bytes.length + 8) >> 6 << 6) + 64);
    withPadding.set(bytes);
    withPadding[bytes.length] = 0x80;
    const view = new DataView(withPadding.buffer);
    view.setUint32(withPadding.length - 4, ml >>> 0, false);
    view.setUint32(withPadding.length - 8, Math.floor(ml / 4294967296), false);

    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const w = new Uint32Array(80);

    for (let offset = 0; offset < withPadding.length; offset += 64) {
      for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
      for (let i = 16; i < 80; i += 1) {
        const n = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
        w[i] = (n << 1) | (n >>> 31);
      }

      let a = h0, b = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i += 1) {
        let f, k;
        if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
        else { f = b ^ c ^ d; k = 0xca62c1d6; }
        const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
        e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = t;
      }

      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }

    const out = new Uint8Array(20);
    new DataView(out.buffer).setUint32(0, h0, false);
    new DataView(out.buffer).setUint32(4, h1, false);
    new DataView(out.buffer).setUint32(8, h2, false);
    new DataView(out.buffer).setUint32(12, h3, false);
    new DataView(out.buffer).setUint32(16, h4, false);
    return out;
  }

  /* ---------------------------------------------------------------- SHA-256 */

  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  function sha256(bytes) {
    const ml = bytes.length * 8;
    const withPadding = new Uint8Array(((bytes.length + 8) >> 6 << 6) + 64);
    withPadding.set(bytes);
    withPadding[bytes.length] = 0x80;
    const view = new DataView(withPadding.buffer);
    view.setUint32(withPadding.length - 4, ml >>> 0, false);
    view.setUint32(withPadding.length - 8, Math.floor(ml / 4294967296), false);

    const h = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    const w = new Uint32Array(64);

    for (let offset = 0; offset < withPadding.length; offset += 64) {
      for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
      for (let i = 16; i < 64; i += 1) {
        const a = w[i - 15];
        const b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }

      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i += 1) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }

      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }

    const out = new Uint8Array(32);
    const dv = new DataView(out.buffer);
    for (let i = 0; i < 8; i += 1) dv.setUint32(i * 4, h[i], false);
    return out;
  }

  /* -------------------------------------------------------------- the shim */

  const toBytes = (data) => {
    if (data instanceof Uint8Array) return data;
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new Uint8Array(data);
  };

  const nameOf = (algorithm) =>
    String(typeof algorithm === 'string' ? algorithm : (algorithm && algorithm.name) || '').toUpperCase();

  const subtle = {
    digest: function (algorithm, data) {
      const name = nameOf(algorithm);
      const bytes = toBytes(data);
      if (name === 'SHA-1') return Promise.resolve(sha1(bytes).buffer);
      if (name === 'SHA-256') return Promise.resolve(sha256(bytes).buffer);
      return Promise.reject(new Error('keystatic-insecure-polyfill: unsupported algorithm ' + name));
    },
  };

  const target = typeof crypto !== 'undefined' ? crypto : (window.crypto = {});
  try {
    Object.defineProperty(target, 'subtle', { value: subtle, configurable: true });
  } catch (error) {
    target.subtle = subtle;
  }

  console.info(
    '[keystatic] crypto.subtle is missing because this page is not served over HTTPS. ' +
      'A digest-only shim is in use so the editor can run. Turn on HTTPS and this stops being needed.',
  );
})();
