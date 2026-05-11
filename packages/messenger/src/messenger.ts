import type { Adapter } from "./adapters/adapter.js";
import type { MessageRef, SendOptions } from "./types.js";
import { NoAdapterError } from "./errors.js";

export interface MessengerOptions {
  adapters: Adapter[];
}

export class Messenger {
  private readonly adapters = new Map<string, Adapter>();

  constructor(opts: MessengerOptions) {
    for (const adapter of opts.adapters) this.register(adapter);
  }

  register(adapter: Adapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  adapter(platform: string): Adapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) throw new NoAdapterError(platform);
    return adapter;
  }

  send(opts: SendOptions): Promise<MessageRef> {
    return this.adapter(opts.to.platform).send(opts);
  }
}
