# Messenger — TODO

Deferred from v1. v1 ships outbound text-only `send()` across an adapter interface.
Everything here is purely additive — the `Adapter` interface and `Messenger` facade
are designed so adding any of these does not break consumers.

## Outbound features

- [ ] `sendPhoto({ to, url | buffer, caption?, parseMode? })`
- [ ] `sendDocument({ to, url | buffer, filename?, caption? })`
- [ ] `reply(ref, text)` — threaded reply to a previous `MessageRef`
- [ ] `edit(ref, text)` — edit a previously sent message
- [ ] `delete(ref)` — delete a previously sent message
- [ ] Inline buttons / quick replies (normalize Telegram inline keyboards ↔ WhatsApp interactive messages)
- [ ] `broadcast(recipients[], message)` — fan-out helper with per-adapter batching
- [ ] Platform-specific options escape hatch on `SendOptions` (e.g. `platformOptions?: { telegram?: {...} }`) for things the abstraction doesn't cover

## Reliability

- [ ] Rate limiting per adapter
  - Telegram: 30 msg/sec global, 1 msg/sec per chat — they will 429 you
  - Token bucket per adapter, configurable
- [ ] Retry with exponential backoff on transient errors (network, 5xx, 429 respecting `retry_after`)
- [ ] Circuit breaker for adapters that are consistently failing
- [ ] Structured error types per failure mode (RateLimited, Unauthorized, InvalidRecipient, etc.) instead of one `MessengerError`

## Inbound

- [ ] Webhook handler factory: framework-agnostic `(req) => Promise<Response>` that works with Hono, Express, Lambda
- [ ] Long-polling mode for local dev (Telegram `getUpdates`)
- [ ] Event handlers: `onMessage`, `onCommand("/check", ...)`, `onCallback` (button presses)
- [ ] Context object passed to handlers: `{ from, chat, text, reply(), platform }`
- [ ] Signature verification per platform (Telegram secret token header, WhatsApp X-Hub-Signature-256, etc.)

## Observability

- [ ] Pluggable logger (`{ debug, info, warn, error }`)
- [ ] Metrics hooks: `onSend`, `onError`, `onRateLimit` — let consumers wire to their own telemetry
- [ ] Optional request/response logging (redacted by default)

## Testing

- [ ] Extend `MockAdapter` with failure injection (`failNext("rate-limit")`, `failNext("network")`)
- [ ] Snapshot helper: `expect(mock).toHaveSentTo(chatId, /price dropped/)`

## Packaging (when extracting to private npm)

- [ ] Rename package — leaning `@youxpowered/hermes` (or `sent-by-hermes` / `from-hermes`)
- [ ] Dual ESM/CJS build via `tsup`
- [ ] README with quickstart per adapter
- [ ] CHANGELOG + semver discipline
- [ ] Publish target: GitHub Packages (cheapest private registry) or npm with `--access restricted`
- [ ] CI: lint, typecheck, test, build on PR

## Future adapters

Rough order based on personal usefulness:

- [ ] **WhatsApp** (Cloud API) — note: 24-hour customer service window, message templates required for outbound outside that window. Will pressure-test the abstraction the most.
- [ ] **Discord** — webhook-based outbound is trivial; full bot is more involved
- [ ] **Slack** — webhook + bot token, useful for work contexts
- [ ] **Email** (SES / Resend / SMTP) — stretches the "messenger" metaphor but the same `send()` shape works
- [ ] **SMS** (Twilio / AWS SNS) — same shape, character limits matter
- [ ] **Signal** — via signal-cli, niche but private
- [ ] **iMessage** — macOS-only, AppleScript bridge; mostly a novelty
- [ ] **Push notifications** (APNs / FCM / web push) — different recipient model (device token, not chat), may need a separate sub-interface
- [ ] **Microsoft Teams** — webhook-based, easy
- [ ] **Matrix** — open protocol, nice-to-have

## Open questions

- Should `Recipient` stay open (`platform: string`) or become a typed discriminated union via module augmentation? Open is simpler; typed catches more bugs but couples adapters to a shared registry.
- Where does the per-adapter rate limiter live — inside each adapter, or as a wrapper in `Messenger`? Wrapper is more reusable but assumes a uniform model.
- Push notifications don't fit the chat-id model cleanly. Sub-interface or separate package?
