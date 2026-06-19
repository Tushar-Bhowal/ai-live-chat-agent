# Channels

The agent core is channel-agnostic. `handleIncomingMessage` in
`../agent/agent.service.ts` takes a normalized `{ channel, sessionId, text }`
and handles persistence, history, the knowledge prompt, and the model call. It
has no idea whether a message came from the web widget or a messaging app.

## Adding a channel (e.g. WhatsApp)

1. Add the channel name to `CHANNELS` in `channel.ts`.
2. Add an inbound adapter (a webhook controller under `http/`) that:
   - verifies the provider's signature,
   - maps the provider's payload to `{ channel, sessionId, text }`
     (use the provider's conversation/thread id as `sessionId`),
   - calls `handleIncomingMessage(...)`,
   - sends the returned `reply` back through the provider's send API.

Nothing in the agent core, persistence, or LLM layers changes — the new
channel reuses all of it. The `channel` column on `Conversation` keeps each
channel's history separate.
