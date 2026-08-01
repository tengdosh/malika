/**
 * Cover images, from Telegram to src/assets/posts/.
 *
 * Telegram offers the same picture two ways and the difference matters:
 *
 *   photo    re-encoded JPEG, capped around 1280px on the long edge
 *   document original bytes, whatever she shot
 *
 * A cover is displayed wide, and astro:assets can only downscale — it cannot
 * invent detail. So both are accepted, and when a compressed photo arrives too
 * small she is told ONCE, in Uzbek, that sending it as a file is sharper. Once:
 * a bot that repeats the same advice on every photo trains her to ignore it.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertSafeSlug } from './slug.mjs';
import { assetsDir } from './entry.mjs';

/** Below this the cover looks soft on a normal screen. */
export const SHARP_ENOUGH = 1400;

/** What astro:assets (sharp) can process. */
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

/** Extension from a Telegram file_path, restricted to what the build accepts. */
export function extensionFor({ filePath, mimeType }) {
  const fromMime = EXTENSIONS[String(mimeType ?? '').toLowerCase()];
  if (fromMime) return fromMime;

  const match = /\.([A-Za-z0-9]+)$/.exec(String(filePath ?? ''));
  const candidate = match?.[1]?.toLowerCase();
  const known = Object.values(EXTENSIONS);
  if (candidate && known.includes(candidate === 'jpeg' ? 'jpg' : candidate)) {
    return candidate === 'jpeg' ? 'jpg' : candidate;
  }
  return null;
}

/**
 * Picks what to download from a message.
 *
 * @param {object} message a Telegram message
 * @returns {{ fileId: string, kind: 'photo'|'document', width?: number, height?: number, mimeType?: string, size?: number }|null}
 */
export function pickImage(message) {
  if (Array.isArray(message?.photo) && message.photo.length) {
    // Telegram sends every rendition; the last is the largest.
    const best = message.photo[message.photo.length - 1];
    return {
      fileId: best.file_id,
      kind: 'photo',
      width: best.width,
      height: best.height,
      size: best.file_size,
    };
  }

  const document = message?.document;
  if (document && String(document.mime_type ?? '').startsWith('image/')) {
    return {
      fileId: document.file_id,
      kind: 'document',
      mimeType: document.mime_type,
      size: document.file_size,
      fileName: document.file_name,
    };
  }

  return null;
}

/** Reasons a cover is refused, phrased for the caller to send verbatim. */
export const REJECTIONS = {
  tooBig: (limit) =>
    `Bu rasm juda katta (${Math.round(limit / (1024 * 1024))} MB dan oshmasin). ` +
    'Kichikroq rasm yuboring.',
  wrongType:
    'Bu turdagi faylni muqova qilib boʻlmaydi. JPG, PNG, WebP yoki AVIF yuboring.',
};

/** Shown at most once per flow, when a compressed photo is small. */
export const SOFT_HINT =
  'Kichik eslatma: rasmni *fayl* qilib yuborsangiz sifati yaxshiroq boʻladi — '
  + 'Telegram rasm sifatida yuborilganini siqib yuboradi.';

/**
 * Downloads a cover and writes it next to the other post assets.
 *
 * @param {object} options
 * @param {import('./telegram.mjs').Telegram} options.telegram
 * @param {object} options.image  from pickImage()
 * @param {string} options.slug   the entry's slug — the filename, never from a message
 * @param {string} options.root   repository working copy
 * @param {number} options.maxBytes
 * @returns {Promise<{ ok: true, filename: string, relative: string, soft: boolean } | { ok: false, message: string }>}
 */
export async function saveCover({ telegram, image, slug, root, maxBytes }) {
  assertSafeSlug(slug);

  if (image.size && image.size > maxBytes) {
    return { ok: false, message: REJECTIONS.tooBig(maxBytes) };
  }

  const file = await telegram.getFile(image.fileId);
  const extension = extensionFor({ filePath: file.file_path, mimeType: image.mimeType });
  if (!extension) return { ok: false, message: REJECTIONS.wrongType };

  if (file.file_size && file.file_size > maxBytes) {
    return { ok: false, message: REJECTIONS.tooBig(maxBytes) };
  }

  const bytes = await telegram.download(file.file_path);
  if (bytes.length > maxBytes) return { ok: false, message: REJECTIONS.tooBig(maxBytes) };

  // The filename is built from the slug, which is transliterated ASCII — no part
  // of it comes from the message.
  const filename = `${slug}.${extension}`;
  const relative = join(assetsDir(), filename);
  writeFileSync(join(root, relative), bytes);

  const soft = image.kind === 'photo' && Number(image.width ?? 0) < SHARP_ENOUGH;
  return { ok: true, filename, relative, soft };
}
