/**
 * Telegram message entities -> Markdown.
 *
 * This is where the bot genuinely beats the CMS: she formats in the app she
 * already uses and the site gets correct Markdown. Three things make it fiddly,
 * and all three are handled here rather than discovered later:
 *
 * 1. **Offsets are UTF-16 code units.** So are JavaScript string indices, so
 *    `text.slice(offset, offset + length)` is correct as-is — but only because
 *    both are UTF-16. An emoji is two units and a naive code-point walk shifts
 *    every entity after it by one.
 *
 * 2. **Entities nest.** A link inside bold arrives as two entities over
 *    overlapping ranges, so this builds a tree rather than splicing markers in
 *    at offsets.
 *
 * 3. **Entities include their trailing space.** `**bold **` is not bold in
 *    Markdown; the whitespace has to move outside the markers.
 *
 * Lists are deliberately NOT escaped. Telegram has no list entity, so `- item`
 * arrives as literal text — which is already the Markdown she meant.
 */

/** Wrappers that take a simple prefix/suffix pair. */
const WRAPPERS = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strikethrough: ['~~', '~~'],
};

/**
 * Rendered as plain text, formatting dropped.
 *
 * `underline` and `spoiler` have no Markdown equivalent, and emitting raw HTML
 * for them would put untrusted-shaped markup into a content file for the sake of
 * an effect that does not exist on the site. `mention`/`url`/`hashtag` are
 * already their own text. `text_mention` links to a Telegram user id, which
 * means nothing on a website.
 */
const PLAIN = new Set([
  'underline',
  'spoiler',
  'mention',
  'text_mention',
  'url',
  'hashtag',
  'cashtag',
  'bot_command',
  'email',
  'phone_number',
  'custom_emoji',
]);

/**
 * Escaped in prose. Kept deliberately small: over-escaping produces content
 * files full of backslashes that are then painful to edit in the CMS.
 */
const ESCAPE = /[\\`*[\]<]/g;

const escapeText = (text) => text.replace(ESCAPE, (char) => `\\${char}`);

/** Moves leading/trailing whitespace outside the markers. */
function balance(inner, open, close) {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
  if (!match) return `${open}${inner}${close}`;
  const [, before, core, after] = match;
  if (!core) return inner;
  return `${before}${open}${core}${close}${after}`;
}

/** A fence long enough to contain the code it wraps. */
function codeSpan(text) {
  const longest = (text.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

function renderNode(node, text, children) {
  const raw = text.slice(node.start, node.end);

  // Code is verbatim: no escaping, no children.
  if (node.type === 'code') return codeSpan(raw);
  if (node.type === 'pre') {
    const language = node.entity.language ?? '';
    const body = raw.replace(/\n+$/, '');
    return `\n\`\`\`${language}\n${body}\n\`\`\`\n`;
  }

  const inner = renderRange(text, children, node.start, node.end);

  if (WRAPPERS[node.type]) {
    const [open, close] = WRAPPERS[node.type];
    return balance(inner, open, close);
  }

  if (node.type === 'text_link') {
    const url = String(node.entity.url ?? '');
    // A URL containing ) or whitespace needs the angle-bracket form.
    const target = /[()\s]/.test(url) ? `<${url}>` : url;
    return `[${inner.trim()}](${target})`;
  }

  if (node.type === 'blockquote' || node.type === 'expandable_blockquote') {
    const quoted = inner
      .split('\n')
      .map((line) => (line.length ? `> ${line}` : '>'))
      .join('\n');
    return `\n${quoted}\n`;
  }

  return inner;
}

/** Renders [start, end), consuming the nodes that fall inside it. */
function renderRange(text, nodes, start, end) {
  let out = '';
  let cursor = start;

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.start < cursor) continue; // already inside a node we emitted
    if (node.start >= end) break;

    out += escapeText(text.slice(cursor, node.start));

    const children = nodes
      .slice(i + 1)
      .filter((child) => child.start >= node.start && child.end <= node.end);

    out += renderNode(node, text, children);
    cursor = node.end;
  }

  return out + escapeText(text.slice(cursor, end));
}

/**
 * @param {string} text  message text, exactly as Telegram sent it
 * @param {Array<{type: string, offset: number, length: number, url?: string, language?: string}>} [entities]
 * @returns {string} Markdown
 */
export function entitiesToMarkdown(text, entities = []) {
  const source = String(text ?? '');
  if (!entities.length) return escapeText(source);

  const nodes = entities
    .filter((entity) => WRAPPERS[entity.type] || PLAIN.has(entity.type) ||
      ['code', 'pre', 'text_link', 'blockquote', 'expandable_blockquote'].includes(entity.type))
    .map((entity) => ({
      type: entity.type,
      entity,
      start: entity.offset,
      end: entity.offset + entity.length,
    }))
    .filter((node) => node.start >= 0 && node.end <= source.length && node.end > node.start)
    // Outermost first: same start, longer range wins.
    .sort((a, b) => a.start - b.start || b.end - a.end);

  return renderRange(source, nodes, 0, source.length);
}

/**
 * Joins the messages of a multi-message body into paragraphs.
 *
 * Telegram caps one message at 4096 characters and an ordinary post runs to
 * several times that, so composition across messages is the normal case, not an
 * edge case. Each message is a paragraph break; newlines inside a message are
 * kept as written.
 *
 * @param {string[]} chunks  already converted to Markdown
 * @returns {string}
 */
export function joinParagraphs(chunks) {
  return chunks
    .map((chunk) => chunk.replace(/\s+$/, '').replace(/^\s+/, ''))
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .concat('\n');
}
