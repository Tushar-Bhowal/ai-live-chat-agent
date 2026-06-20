# AI Live Chat Agent

A customer-support live chat where an AI agent answers questions about a store —
shipping, returns, support hours, order tracking, and payments — grounded in a
small knowledge base. Conversations are persisted and reload on refresh, errors
are handled gracefully, and the system is deliberately structured so new
**channels** (WhatsApp, Instagram) and **tools** (order lookups, etc.) can be
added with minimal change.

- **Backend:** Node.js, TypeScript (strict), Express 5, Prisma 7, PostgreSQL, Zod
- **LLM:** OpenRouter (OpenAI-compatible API) behind a provider interface
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [LLM integration](#llm-integration)
- [Deployment](#deployment)
- [Trade-offs and next steps](#trade-offs-and-next-steps)

---

## Features

- Real-time support chat backed by a real LLM, answering only from a seeded
  knowledge base and offering a human handoff when it doesn't know.
- Tool calling: the agent looks up live order status through a tool when a
  customer provides an order id, rather than guessing.
- Conversations persisted in PostgreSQL; history reloads on refresh via a
  session id stored in the browser.
- Typing indicator, auto-scroll, in-flight send disabling, Markdown-rendered
  replies, light/dark theme, and a mobile-responsive layout.
- Robust input handling: validation, length caps, request-size limits, an LLM
  timeout, and friendly error messages for every failure mode.

---

## Architecture

The backend is layered, with a strict one-directional dependency flow and no
business logic in the HTTP layer:

```
HTTP routes  ->  domain services  ->  repositories  ->  Prisma / PostgreSQL
 (validate)      (agent, knowledge,    (only layer that
                  LLM provider)         touches the DB)
```

Two abstractions carry the extensibility story:

### 1. LLM provider interface

Every model vendor sits behind one interface:

```ts
interface LLMProvider {
  generateReply(systemPrompt: string, history: ChatMessage[]): Promise<string>;
}
```

The agent, persistence, and HTTP layers never import a vendor SDK. The active
provider is chosen from the `LLM_PROVIDER` environment variable, so swapping
models or vendors is a configuration change, not a code change. Failures are
normalized into a typed `LLMError` (timeout, auth, rate limit, network, …) so
callers can react without knowing which SDK produced them.

### 2. Channel-agnostic agent core

All channels funnel through one entry point:

```ts
handleIncomingMessage({ channel, sessionId?, text }): Promise<{ reply, sessionId }>
```

Its flow:

1. Validate and trim the message (empty / too long are rejected).
2. Get or create the conversation for the session id.
3. Persist the user message.
4. Load the recent history window (last 10 messages) for context.
5. Build the system prompt from the FAQ rows plus the agent persona.
6. Call the configured LLM provider (with a timeout).
7. Persist the assistant reply and return it with the session id.

The HTTP route for the web widget is a thin adapter over this function. A
WhatsApp or Instagram webhook would be another thin adapter calling the exact
same function — see [`server/src/domain/channels/README.md`](server/src/domain/channels/README.md).
The `channel` column on each conversation keeps every channel's history
separate.

**Where tools plug in.** Step 5–6 is the seam where an agent would consult
tools. A tool is modelled as `{ name, description, execute() }` in
[`server/src/domain/tools/tool.ts`](server/src/domain/tools/tool.ts), and the
agent marks exactly where tool calls would resolve — so adding, for example, an
`order_status` lookup is localized to that seam.

---

## Project structure

```
server/
  prisma/
    schema.prisma            # Conversation, Message, Faq + Sender enum
    seed.ts                  # seeds the store's FAQ knowledge base
  src/
    config/env.ts            # Zod-validated env, fails fast at startup
    db/client.ts             # Prisma client singleton (driver adapter)
    repositories/            # the only layer that touches Prisma
    domain/
      llm/                   # LLMProvider interface + OpenRouter implementation
      knowledge/             # builds the system prompt from FAQ rows
      channels/              # channel type + how to add a channel
      tools/                 # tool interface + registry (extension point)
      agent/                 # handleIncomingMessage — channel-agnostic core
    http/
      routes/                # thin request adapters
      middleware/            # central error handler
      server.ts              # builds the Express app
    index.ts                 # entrypoint
web/
  src/
    components/              # ChatWidget, MessageList, MessageInput, ui/
    hooks/useChat.ts         # chat state: history, sending, errors
    lib/                     # api client, session storage
```

---

## Running locally

### Prerequisites

- Node.js 20+ and npm
- A PostgreSQL database (a local instance is fine)
- An [OpenRouter](https://openrouter.ai) API key (free, no card required)

### 1. Backend

```bash
cd server
npm install
cp .env.example .env          # then fill in the values (see below)
```

Set at least `DATABASE_URL` and `OPENROUTER_API_KEY` in `server/.env`.

Create the schema and seed the knowledge base:

```bash
npx prisma migrate dev        # applies migrations and generates the client
npx prisma db seed            # inserts the store's FAQ rows
```

- `prisma migrate dev` applies the SQL migrations to your database and
  (re)generates the typed Prisma client.
- `prisma db seed` runs `prisma/seed.ts`, which clears and re-inserts the FAQ
  rows the agent answers from.

Start the API:

```bash
npm run dev                   # http://localhost:4000  (GET /health -> { "status": "ok" })
```

### 2. Frontend

```bash
cd web
npm install
cp .env.example .env          # VITE_API_BASE_URL defaults to http://localhost:4000
npm run dev                   # http://localhost:5173
```

Open the printed URL and start chatting. Send a message, reload the page, and
your conversation is restored.

### Useful scripts

| Location | Command | Description |
|---|---|---|
| `server` | `npm run dev` | Start the API with hot reload |
| `server` | `npm run build` / `npm start` | Compile to `dist/` and run it |
| `server` | `npm run typecheck` | Type-check without emitting |
| `web` | `npm run dev` | Start the Vite dev server |
| `web` | `npm run build` | Production build |

---

## Environment variables

### Backend (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. In production, the pooled connection string. |
| `DIRECT_URL` | Prod | Direct (non-pooled) connection string used for migrations. |
| `LLM_PROVIDER` | No | `openrouter` (default), `gemini`, or `anthropic`. |
| `OPENROUTER_API_KEY` | Yes* | OpenRouter key — get one at [openrouter.ai](https://openrouter.ai). *Required when `LLM_PROVIDER=openrouter`. |
| `OPENROUTER_MODEL` | Yes* | Pinned model id, e.g. `openai/gpt-oss-120b:free`. Free model availability rotates — see [openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0). |
| `GEMINI_API_KEY` | Yes* | Google AI Studio key — get one at [aistudio.google.com](https://aistudio.google.com). *Required when `LLM_PROVIDER=gemini`. |
| `GEMINI_MODEL` | Yes* | Gemini model id, e.g. `gemini-2.5-flash`. *Required when `LLM_PROVIDER=gemini`. |
| `ANTHROPIC_API_KEY` | No | Reserved for a future direct-Anthropic provider. |
| `PORT` | No | API port (default `4000`). |
| `CORS_ORIGIN` | No | Allowed frontend origin. Leave empty in local dev to accept any localhost origin; set the deployed URL in production. |
| `NODE_ENV` | No | `development` (default), `test`, or `production`. |

Environment is validated at startup; the process exits with a clear message if
a required value (such as the active provider's key or `DATABASE_URL`) is
missing.

### Frontend (`web/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | No | Backend base URL (default `http://localhost:4000`). Set to the deployed API URL in production. |

Only `.env.example` files are committed; real `.env` files are git-ignored.

---

## API reference

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/chat/message` | `{ "message": string, "sessionId"?: string }` | `200 { "reply": string, "sessionId": string }` |
| `GET` | `/chat/:sessionId/messages` | — | `200 { "messages": [{ "sender": "user"\|"ai", "text": string, "createdAt": string }] }` |
| `GET` | `/health` | — | `200 { "status": "ok" }` |

Error responses are always JSON `{ "error": string }`:

- `400` — empty message, missing field, over the 4000-character cap, or
  malformed JSON.
- `413` — request body larger than the limit.
- `502` — the model provider was unavailable (timeout, auth, rate limit, or
  network); the precise cause is logged server-side.

`GET /chat/:sessionId/messages` returns an empty list for an unknown session
rather than a 404, so the widget can always restore cleanly.

---

## LLM integration

The LLM integration sits behind a single `LLMProvider` interface, so the agent
logic, persistence, and channel handling never depend on any specific vendor.
Two implementations ship — one over OpenRouter (the OpenAI-compatible SDK) and
one over Google Gemini (a structurally different SDK: `user`/`model` roles, a
separate system instruction, and its own function-calling format) — proving the
abstraction holds across genuinely different backends. The active one is chosen
by the `LLM_PROVIDER` environment variable. The default routes through
OpenRouter, which itself gives access to many models — free open-source up to
frontier GPT/Claude/Gemini — by changing one model string, making the system
model-agnostic out of the box and letting cost and quality be tuned per
environment without code changes. The deployment
defaults to a free model because a support-FAQ workload doesn't need a frontier
model, and it keeps the demo at zero marginal cost — the same discipline I'd
apply in production (cheap models for simple tasks, expensive ones reserved for
hard cases).

**System prompt and context.** The system prompt is assembled at request time
from the agent's persona plus the FAQ rows in the database — store policies are
never hardcoded in the prompt, so updating them is a data change. Only the last
ten messages of a conversation are sent as context, bounding prompt size and
token cost, and the reply is capped (max output tokens) for the same reason.

**Resilience.** Each model call runs under a 30-second timeout (an
`AbortController`), retries are capped so a transient rate limit surfaces as
itself rather than as a timeout, and every provider error is mapped to a typed
`LLMError` and shown to the user as one friendly message.

**Trade-offs.** OpenRouter adds a network hop and an external dependency, and
free models carry rate limits and can be rotated out — both acceptable at this
scope and cheap to escape, since swapping providers or pinning a paid model is a
one-class change. In production I'd add provider fallback/retry routing, a
circuit breaker, response caching for common FAQs, and per-tenant model config.

---

## Deployment

The app is designed to deploy on free tiers:

- **Database — [Neon](https://neon.tech)** (serverless PostgreSQL). Use the
  pooled connection string as `DATABASE_URL` and the direct string as
  `DIRECT_URL`.
- **Backend — [Render](https://render.com)** (free web service).
  - Build: `npm install && npx prisma generate && npm run build`
  - Start: `npm start`
  - Run `npx prisma migrate deploy` once against the database (uses `DIRECT_URL`).
  - Set all backend environment variables in the dashboard, and a `/health`
    uptime ping to mitigate cold starts.
- **Frontend — [Vercel](https://vercel.com)**. Set `VITE_API_BASE_URL` to the
  Render API URL.

Set `CORS_ORIGIN` on the backend to the deployed frontend URL. On free tiers the
first request after idle can be slow due to cold starts.

---

## Trade-offs and next steps

Things intentionally left out to keep the scope tight, and what I'd add next:

- **Retrieval over the FAQ.** The full FAQ set is small enough to put in the
  prompt; at scale I'd embed and retrieve only the relevant entries (RAG).
- **Streaming responses.** Server-sent events would replace the typing
  indicator with real token streaming for a snappier feel.
- **More tools.** The order-status lookup demonstrates the tool loop; real tools
  (returns, address changes, live order systems) would slot into the same registry.
- **More providers.** OpenRouter and Gemini are both implemented; a direct
  Anthropic implementation of the same interface is a drop-in selectable via
  `LLM_PROVIDER`, and provider fallback/retry routing would harden availability.
- **Rate limiting, tests, and observability.** Per-session rate limiting,
  unit tests around validation and a mocked provider, and structured request
  logging/metrics would all harden it for real traffic.
