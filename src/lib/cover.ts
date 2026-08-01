import type { ImageMetadata } from 'astro';

/**
 * Decides whether an entry's cover image may be rendered.
 *
 * A cover with no alt text is NOT a build failure. It renders the post without
 * the image and logs a warning instead — because that failure is visible to
 * Malika without anyone reading a log: she opens her post, the photo is missing,
 * and she fixes it herself. Self-correcting feedback beats a failed build she
 * never sees.
 *
 * An image with no alt text would be invisible to anyone using a screen reader,
 * so shipping it silently is not an option either. Withholding it is the only
 * outcome that is both accessible and non-blocking.
 */
export interface UsableCover {
  src: ImageMetadata;
  alt: string;
}

/** One warning per entry per build, however many components ask. */
const warned = new Set<string>();

export function usableCover(entry: {
  id: string;
  collection: string;
  data: { cover?: ImageMetadata; coverAlt?: string };
}): UsableCover | null {
  const { cover, coverAlt } = entry.data;
  if (!cover) return null;

  const alt = coverAlt?.trim();
  if (alt) return { src: cover, alt };

  const key = `${entry.collection}/${entry.id}`;
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(
      `[cover] ${key}: rasm bor, lekin "coverAlt" yoʻq — rasm koʻrsatilmadi.\n` +
        '        A cover image with no alt text is unreadable to screen readers, so it is\n' +
        '        withheld rather than shipped. The post itself renders normally and the\n' +
        '        build is NOT failed. Add "Rasm tavsifi" in the admin to bring it back.',
    );
  }
  return null;
}
