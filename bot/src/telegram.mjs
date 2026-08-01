/**
 * A small Bot API client — long polling, no webhook.
 *
 * Long polling means there is no public endpoint to secure, no TLS certificate
 * to renew and nothing to break when the site's proxy changes. The bot reaches
 * out; nothing reaches in.
 *
 * Hand-rolled rather than a framework: the surface actually needed is eight
 * methods, the repo keeps a supply-chain policy on its lockfile, and a client
 * whose transport is a constructor argument can be driven end-to-end in a check
 * without a token or a network.
 */

/** Telegram rejects anything longer; the preview is the message that hits it. */
export const MAX_MESSAGE = 4096;

export class TelegramError extends Error {
  constructor(method, description, code) {
    super(`${method}: ${description}`);
    this.name = 'TelegramError';
    this.code = code;
  }
}

export class Telegram {
  /**
   * @param {object} options
   * @param {string} options.token
   * @param {typeof fetch} [options.fetchImpl] injected by the checks
   * @param {(message: string) => void} [options.log]
   */
  constructor({ token, fetchImpl = fetch, log = () => {} }) {
    this.token = token;
    this.fetch = fetchImpl;
    this.log = log;
  }

  get #base() {
    return `https://api.telegram.org/bot${this.token}`;
  }

  /**
   * One API call. Retries 429 and 5xx; everything else surfaces immediately,
   * because a 400 means the bot asked for something impossible and retrying it
   * just repeats the mistake.
   */
  async call(method, params = {}, { attempt = 0 } = {}) {
    const response = await this.fetch(`${this.#base}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });

    const payload = await response.json().catch(() => ({}));

    if (payload.ok) return payload.result;

    const retryAfter = payload.parameters?.retry_after;
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < 3) {
      const wait = (retryAfter ?? 2 ** attempt) * 1000;
      this.log(`${method}: ${response.status}, retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      return this.call(method, params, { attempt: attempt + 1 });
    }

    throw new TelegramError(method, payload.description ?? `HTTP ${response.status}`, response.status);
  }

  getMe() {
    return this.call('getMe');
  }

  /** Long poll. `timeout` is seconds Telegram holds the connection open. */
  getUpdates(offset, timeout = 50) {
    return this.call('getUpdates', {
      offset,
      timeout,
      allowed_updates: ['message', 'callback_query'],
    });
  }

  /**
   * Sends text, splitting on paragraph boundaries when it exceeds the limit.
   * The preview of a long post is exactly the message that would otherwise be
   * silently rejected.
   */
  async sendMessage(chatId, text, extra = {}) {
    const parts = splitMessage(String(text));
    let last;
    for (const [index, part] of parts.entries()) {
      last = await this.call('sendMessage', {
        chat_id: chatId,
        text: part,
        // Keyboards belong on the final part only.
        ...(index === parts.length - 1 ? extra : {}),
      });
    }
    return last;
  }

  editMessageText(chatId, messageId, text, extra = {}) {
    return this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: splitMessage(String(text))[0],
      ...extra,
    });
  }

  answerCallbackQuery(id, text) {
    return this.call('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) });
  }

  setMyCommands(commands) {
    return this.call('setMyCommands', { commands });
  }

  getFile(fileId) {
    return this.call('getFile', { file_id: fileId });
  }

  /** Downloads a file previously located with getFile. */
  async download(filePath) {
    const response = await this.fetch(
      `https://api.telegram.org/file/bot${this.token}/${filePath}`,
    );
    if (!response.ok) throw new Error(`download ${filePath}: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
}

/**
 * Splits at paragraph, then line, then hard boundaries — never mid-word if it
 * can be helped.
 *
 * @param {string} text
 * @param {number} [limit]
 * @returns {string[]}
 */
export function splitMessage(text, limit = MAX_MESSAGE) {
  if (text.length <= limit) return [text];

  const parts = [];
  let rest = text;

  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    const cut =
      window.lastIndexOf('\n\n') > limit * 0.5
        ? window.lastIndexOf('\n\n')
        : window.lastIndexOf('\n') > limit * 0.5
          ? window.lastIndexOf('\n')
          : window.lastIndexOf(' ') > limit * 0.5
            ? window.lastIndexOf(' ')
            : limit;

    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }

  if (rest) parts.push(rest);
  return parts;
}

/** An inline keyboard row-per-item, or `columns` per row. */
export const keyboard = (buttons, columns = 2) => {
  const rows = [];
  for (let i = 0; i < buttons.length; i += columns) {
    rows.push(buttons.slice(i, i + columns).map(([text, data]) => ({ text, callback_data: data })));
  }
  return { reply_markup: { inline_keyboard: rows } };
};
