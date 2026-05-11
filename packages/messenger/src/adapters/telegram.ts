import type { Adapter } from "./adapter.js";
import type { MessageRef, ParseMode, SendOptions } from "../types.js";
import { MessengerError } from "../errors.js";

export interface TelegramAdapterOptions {
  token: string;
  apiBase?: string;
}

interface TelegramSendMessageBody {
  chat_id: string | number;
  text: string;
  parse_mode?: "Markdown" | "HTML";
  disable_web_page_preview?: boolean;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
}

const parseModeMap: Record<ParseMode, "Markdown" | "HTML"> = {
  markdown: "Markdown",
  html: "HTML",
};

export class TelegramAdapter implements Adapter {
  readonly platform = "telegram";
  private readonly token: string;
  private readonly apiBase: string;

  constructor(opts: TelegramAdapterOptions) {
    if (!opts.token) throw new MessengerError("TelegramAdapter requires a token");
    this.token = opts.token;
    this.apiBase = opts.apiBase ?? "https://api.telegram.org";
  }

  async send(opts: SendOptions): Promise<MessageRef> {
    const body: TelegramSendMessageBody = {
      chat_id: opts.to.chatId,
      text: opts.text,
    };
    if (opts.parseMode) body.parse_mode = parseModeMap[opts.parseMode];
    if (opts.disableLinkPreview) body.disable_web_page_preview = true;

    const result = await this.call<TelegramMessage>("sendMessage", body);
    return {
      platform: this.platform,
      chatId: result.chat.id,
      messageId: result.message_id,
    };
  }

  private async call<T>(method: string, body: unknown): Promise<T> {
    const url = `${this.apiBase}/bot${this.token}/${method}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new MessengerError(`Telegram request failed: ${method}`, cause);
    }

    const json = (await res.json()) as TelegramResponse<T>;
    if (!json.ok || json.result === undefined) {
      throw new MessengerError(
        `Telegram ${method} failed: ${json.error_code ?? res.status} ${json.description ?? ""}`.trim(),
      );
    }
    return json.result;
  }
}
