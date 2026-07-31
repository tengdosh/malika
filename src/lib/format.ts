/**
 * Uzbek date formatting, hand-rolled rather than via Intl so the output is
 * identical everywhere and does not depend on the build machine's ICU data.
 */
const MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
] as const;

/** e.g. 12-iyul, 2026 */
export function formatDate(date: Date): string {
  const month = MONTHS[date.getUTCMonth()] ?? '';
  return `${date.getUTCDate()}-${month}, ${date.getUTCFullYear()}`;
}

/** Machine-readable, for <time datetime>. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
