import type { MessageRef, SendOptions } from "../types.js";

export interface Adapter {
  readonly platform: string;
  send(opts: SendOptions): Promise<MessageRef>;
}
