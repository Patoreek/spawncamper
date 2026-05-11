import type { Adapter } from "./adapter.js";
import type { MessageRef, SendOptions } from "../types.js";

export interface MockSent {
  opts: SendOptions;
  ref: MessageRef;
}

export class MockAdapter implements Adapter {
  readonly platform: string;
  readonly sent: MockSent[] = [];
  private nextId = 1;

  constructor(platform = "mock") {
    this.platform = platform;
  }

  async send(opts: SendOptions): Promise<MessageRef> {
    const ref: MessageRef = {
      platform: this.platform,
      chatId: opts.to.chatId,
      messageId: this.nextId++,
    };
    this.sent.push({ opts, ref });
    return ref;
  }

  clear(): void {
    this.sent.length = 0;
    this.nextId = 1;
  }
}
