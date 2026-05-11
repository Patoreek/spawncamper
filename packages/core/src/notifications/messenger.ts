import { Messenger, TelegramAdapter, type Recipient } from '@spawncamper/messenger';

interface MessengerHandle {
  messenger: Messenger;
  recipient: Recipient;
}

let handle: MessengerHandle | null | undefined;

/**
 * Lazily builds a Messenger from TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID env vars.
 * Returns null if either is missing — callers should treat that as "notifications disabled".
 */
export const getMessenger = (): MessengerHandle | null => {
  if (handle !== undefined) return handle;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    handle = null;
    return handle;
  }

  const messenger = new Messenger({ adapters: [new TelegramAdapter({ token })] });
  handle = {
    messenger,
    recipient: { platform: 'telegram', chatId },
  };
  return handle;
};

/** Reset the cached handle. Mostly useful for tests. */
export const resetMessenger = (): void => {
  handle = undefined;
};
