export class MessengerError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "MessengerError";
  }
}

export class NoAdapterError extends MessengerError {
  constructor(platform: string) {
    super(`No adapter registered for platform "${platform}"`);
    this.name = "NoAdapterError";
  }
}
