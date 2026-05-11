export type ChatId = string | number;

export interface Recipient {
  platform: string;
  chatId: ChatId;
}

export type ParseMode = "markdown" | "html";

export interface SendOptions {
  to: Recipient;
  text: string;
  parseMode?: ParseMode;
  disableLinkPreview?: boolean;
}

export interface MessageRef {
  platform: string;
  chatId: ChatId;
  messageId: string | number;
}
