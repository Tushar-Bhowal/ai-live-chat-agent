# AI Live Chat Agent

A customer-support live chat where an AI agent ("Mira") answers questions about
an online store — shipping, returns, support hours, order tracking, payments —
and can look up a live order status. Answers are grounded in a small knowledge
base, conversations are saved and reload on refresh, and every failure is
handled gracefully.

The codebase is deliberately structured so new **channels** (WhatsApp,
Instagram) and new **tools** (order lookups, returns, etc.) can be added with
very little change. That extensibility is the main design goal.

![Mira — the AI support chat widget](docs/screenshot.png)

- **Backend:** Node.js, TypeScript (strict), Express 5, Prisma 7, PostgreSQL, Zod
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui
- **LLM:** any model via OpenRouter (default) or Google Gemini, behind one interface

---

## Live demo

- **App:** https://ai-live-chat-agent-pi.vercel.app
- **API:** https://ai-live-chat-agent-fuda.onrender.com

> **The first request may take ~30–60 seconds — this is expected.** The backend
> runs on Render's free tier, which spins the server down after ~15 minutes of
> inactivity. The first request after it's been idle has to wake the server, so
> the very first reply (or the page's history load) can take up to a minute — the
> typing indicator will simply spin a little longer. **Every request after that
> is fast.** If your first message seems stuck, give it up to a minute and it
> will come through.
>
> To skip the wait when demoing: open the API health URL first to warm it —
> [/health](https://ai-live-chat-agent-fuda.onrender.com/health) — wait for
> `{"status":"ok"}`, then use the app. (In a real deployment you'd keep it warm
> with a free uptime pinger like UptimeRobot hitting `/health` every ~10 minutes.)

---

## Contents

- [Live demo](#live-demo)
- [What it does](#what-it-does)
- [How it works (architecture)](#how-it-works-architecture)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup, step by step](#setup-step-by-step)
- [Environment variables](#environment-variables)
- [Choosing and switching the LLM provider](#choosing-and-switching-the-llm-provider)
- [Verify everything works](#verify-everything-works)
- [API reference](#api-reference)
- [How the LLM layer works](#how-the-llm-layer-works)
- [Tool calling](#tool-calling)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Trade-offs and next steps](#trade-offs-and-next-steps)

---

## What it does

- Real-time support chat backed by a real LLM. The agent answers **only** from a
  seeded knowledge base and offers to connect a human when it doesn't know —
  it never invents policies or prices.
- **Tool calling:** when a customer gives an order id, the agent calls a tool to
  fetch that order's status instead of guessing.
- **Persistence:** conversations are stored in PostgreSQL. A session id is kept
  in the browser, so reloading the page restores the full history.
- **Polished UX:** typing indicator, smooth auto-scroll, send disabled while a
  reply is in flight, Markdown-rendered replies, light/dark theme, mobile layout.
- **Robust:** input validation, length and body-size caps, a request timeout on
  the model call, and a friendly message for every error.

---

## How it works (architecture)

The backend is layered. Dependencies flow one direction, and there is no
business logic in the HTTP layer:

```
HTTP routes  ->  domain services          ->  repositories      ->  PostgreSQL
 (validate)      (agent, knowledge, LLM)      (only DB access)
```

Two abstractions make it extensible.

### 1. One interface for every model vendor

```ts
interface LLMProvider {
  generateReply(
    systemPrompt: string,
    history: ChatMessage[],
    tools?: Tool[],
  ): Promise<string>;
}
```

The agent, the database layer, and the HTTP layer never import a vendor SDK.
Which provider runs is decided by the `LLM_PROVIDER` env var, so changing model
or vendor is configuration, not code. Two providers ship today — **OpenRouter**
and **Google Gemini** — and any failure is converted into a typed `LLMError`
(timeout, auth, rate limit, network, …) so callers react the same way regardless
of which SDK produced the error.

### 2. One channel-agnostic entry point

Every channel funnels through a single function:

```ts
handleIncomingMessage({ channel, sessionId?, text }): Promise<{ reply, sessionId }>
```

What it does, in order:

1. Validate and trim the message (empty or over 4000 chars is rejected).
2. Get or create the conversation for that session id.
3. Save the user's message.
4. Load the last 10 messages as context.
5. Build the system prompt from the FAQ rows + the agent persona.
6. Call the configured LLM provider (passing the available tools, under a timeout).
7. Save the reply and return it with the session id.

The web widget's HTTP route is a thin wrapper over this function. A WhatsApp or
Instagram webhook would be another thin wrapper calling the *same* function —
see [server/src/domain/channels/README.md](server/src/domain/channels/README.md).
The `channel` column on each conversation keeps every channel's history separate.

**Tools** live in [server/src/domain/tools/](server/src/domain/tools/). A tool is
just `{ name, description, parameters, execute() }`. The agent hands the tool list
to the provider, the provider runs the call loop (model asks → we run the tool →
feed the result back → model answers), and adding a new tool means writing one
file and listing it in the registry.

---

## Project structure

```
server/
  prisma/
    schema.prisma            # Conversation, Message, Faq + Sender enum
    seed.ts                  # seeds the store's FAQ knowledge base
  src/
    config/env.ts            # validates env at startup, fails fast
    db/client.ts             # Prisma client singleton (driver adapter)
    repositories/            # the only layer that touches Prisma
    domain/
      llm/                   # LLMProvider interface + OpenRouter & Gemini impls
      knowledge/             # builds the system prompt from FAQ rows
      channels/              # channel type + how to add a channel
      tools/                 # tool interface, registry, order-status tool
      agent/                 # handleIncomingMessage — channel-agnostic core
    http/
      routes/                # thin request adapters
      middleware/            # central error handler
      server.ts              # builds the Express app
    index.ts                 # entrypoint
web/
  src/
    components/              # ChatWidget, MessageList, MessageInput, ui/
    hooks/                   # useChat (chat state), usePrefersReducedMotion
    lib/                     # api client, session storage
```

---

## Prerequisites

- **Node.js 20+** and npm — check with `node -v`.
- **PostgreSQL** running locally (any recent version). Check with `psql --version`.
- **One LLM API key** (both have free options, no credit card):
  - **OpenRouter** (default) — sign up at [openrouter.ai](https://openrouter.ai),
    create a key under *Keys*.
  - **Google Gemini** (optional second provider) — get a free key at
    [aistudio.google.com](https://aistudio.google.com) → *Get API key*.

---

## Setup, step by step

### Step 1 — Create the database

Create a dedicated database and user (so the app doesn't run as the Postgres
superuser). Run `psql` as your Postgres admin user, then:

```sql
CREATE ROLE livechat LOGIN PASSWORD 'change-me';
ALTER ROLE livechat CREATEDB;          -- needed for Prisma's migration shadow DB
CREATE DATABASE livechat OWNER livechat;
```

Your connection string will be:

```
postgresql://livechat:change-me@localhost:5432/livechat?schema=public
```

> Any PostgreSQL works — local, Docker, or a cloud provider like Neon. Just use
> its connection string in the next step.

### Step 2 — Configure and start the backend

```bash
cd server
npm install
cp .env.example .env
```

Open `server/.env` and set, at minimum:

- `DATABASE_URL` — the connection string from Step 1
- `OPENROUTER_API_KEY` — your OpenRouter key
- `OPENROUTER_MODEL` — already defaults to a free model (`openai/gpt-oss-120b:free`)

Create the tables and load the FAQ data:

```bash
npx prisma migrate dev     # creates the tables and generates the Prisma client
npx prisma db seed         # inserts the store's FAQ rows the agent answers from
```

- `prisma migrate dev` applies the SQL migrations and generates the typed client
  into `src/generated/prisma`.
- `prisma db seed` runs `prisma/seed.ts`, which loads the FAQ knowledge base.
  **This step is required** — without it the agent has no knowledge to answer from.

Start the API (auto-reloads on code changes):

```bash
npm run dev                # http://localhost:4000
```

You should see `Server listening on http://localhost:4000`.

### Step 3 — Start the frontend

In a second terminal:

```bash
cd web
npm install
cp .env.example .env        # VITE_API_BASE_URL defaults to http://localhost:4000
npm run dev                 # http://localhost:5173
```

Open the printed URL, chat with Mira, then reload the page — your conversation
is restored.

### Scripts

| Location | Command | What it does |
|---|---|---|
| `server` | `npm run dev` | Start the API with hot reload (auto-restarts on changes) |
| `server` | `npm run build` then `npm start` | Compile to `dist/` and run the compiled server |
| `server` | `npm run typecheck` | Type-check the whole project |
| `web` | `npm run dev` | Start the Vite dev server with hot reload |
| `web` | `npm run build` | Production build of the frontend |

---

## Environment variables

### Backend (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. In production, the pooled string. |
| `DIRECT_URL` | Prod only | Direct (non-pooled) string used for migrations on hosts like Neon. Unused locally. |
| `LLM_PROVIDER` | No | Which provider to use: `openrouter` (default) or `gemini`. |
| `OPENROUTER_API_KEY` | If using OpenRouter | Key from [openrouter.ai](https://openrouter.ai). |
| `OPENROUTER_MODEL` | If using OpenRouter | Model id, e.g. `openai/gpt-oss-120b:free`. Free models rotate — browse current ones at [openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0). |
| `GEMINI_API_KEY` | If using Gemini | Key from [aistudio.google.com](https://aistudio.google.com). |
| `GEMINI_MODEL` | If using Gemini | Model id, e.g. `gemini-2.5-flash`. |
| `ANTHROPIC_API_KEY` | No | Reserved for a future direct-Anthropic provider; not wired up. |
| `PORT` | No | API port (default `4000`). |
| `CORS_ORIGIN` | No | Allowed frontend origin. Leave **empty** in local dev to accept any localhost port; set the deployed frontend URL in production. |
| `NODE_ENV` | No | `development` (default), `test`, or `production`. |

The server validates these at startup and **exits with a clear message** if a
required value is missing — for example, choosing `LLM_PROVIDER=gemini` without a
`GEMINI_API_KEY` stops the server immediately rather than failing mid-request.

### Frontend (`web/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | No | Backend base URL (default `http://localhost:4000`). Set to the deployed API URL in production. |

Only `.env.example` files are committed. Real `.env` files (with your keys) are
git-ignored and never leave your machine.

---

## Choosing and switching the LLM provider

### Why OpenRouter is the default

OpenRouter is a single, OpenAI-compatible gateway to hundreds of models. That
choice does a few things at once:

- **Model-agnostic from day one.** You can move from a free open-source model to
  a frontier GPT/Claude/Gemini model by changing **one string** (`OPENROUTER_MODEL`)
  — no code change, no new SDK.
- **Zero-cost demo.** It defaults to a free model, because a support-FAQ workload
  doesn't need a frontier model. That's the same discipline you'd want in
  production: cheap models for easy tasks, expensive ones reserved for hard cases.
- **It keeps the abstraction honest.** Because the app talks to OpenRouter through
  the generic `LLMProvider` interface, swapping the whole vendor is a one-file change.

To prove that abstraction isn't just theoretical, the project also implements a
**second provider on a completely different SDK — Google Gemini**. Gemini's SDK
is structurally different from the OpenAI shape (it uses `user`/`model` roles, a
separate `systemInstruction`, and its own function-calling format), yet it
satisfies the exact same interface. So the same agent, persistence, and tools run
unchanged on two genuinely different backends — which is the real test of a clean
abstraction. (A direct OpenAI provider was skipped on purpose: it would reuse the
same SDK shape as OpenRouter and prove almost nothing.)

### How to switch providers

Edit `server/.env`, then **restart the server** (env is read once at startup, so
a restart is required — `Ctrl+C`, then `npm run dev`).

**Use OpenRouter (default):**

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-oss-120b:free
```

**Use Gemini:**

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash
```

That's the only change. Send a message and confirm the reply still works (see the
next section). Both providers support the order-status tool.

> Note: free tiers carry rate limits and models get rotated out. If a model
> returns a `404` or you see frequent `429`s, pick another current free model
> (OpenRouter: the link above; Gemini: try `gemini-2.5-flash`).

---

## Verify everything works

Run these after the backend is started. They confirm each part of the system.

**1. The server is up**

```bash
curl http://localhost:4000/health
# -> {"status":"ok"}
```

**2. The agent answers from the knowledge base**

```bash
curl -s -X POST http://localhost:4000/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message":"What is your return policy?"}'
# -> {"reply":"You can return any item within 30 days ...","sessionId":"..."}
```

A real, on-topic answer means the database, knowledge base, and LLM provider are
all working together.

**3. Tool calling works** (mock orders are `ORD-1001`, `ORD-1002`, `ORD-1003`)

```bash
curl -s -X POST http://localhost:4000/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the status of order ORD-1001?"}'
# -> reply mentions "shipped", carrier "BlueDart", and an estimated date
```

**4. History persists.** Copy the `sessionId` from a response and fetch it back:

```bash
curl http://localhost:4000/chat/<sessionId>/messages
# -> {"messages":[{"sender":"user",...},{"sender":"ai",...}]}
```

In the browser, this is what makes a page reload restore the conversation.

**5. Inspect the database** (optional) — browse the saved data visually:

```bash
cd server && npx prisma studio      # opens a local DB browser
```

**6. Confirm the active provider.** Switch `LLM_PROVIDER` in `.env`, restart, and
repeat steps 2–3. If a key is wrong, you'll get a friendly `502` from the API and
a precise reason in the **server logs** (e.g. `LLM error [auth]: 401`) — that's
the design: users see one friendly line, operators see the real cause.

**What the errors mean**

| You see | Meaning | Fix |
|---|---|---|
| Server exits at startup with "Invalid environment configuration" | A required env var is missing | Set the named variable in `.env` |
| `502 The assistant is unavailable right now` | The model provider failed (bad key, rate limit, timeout, network) | Check server logs for `LLM error [kind]`; fix the key or pick another model |
| `400 message is required` / `message too long` | Empty or over-4000-char message | Expected validation |
| CORS error in the browser | Backend rejected the frontend origin | Leave `CORS_ORIGIN` empty in local dev, or set it to your frontend URL |

---

## API reference

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/chat/message` | `{ "message": string, "sessionId"?: string }` | `200 { "reply": string, "sessionId": string }` |
| `GET` | `/chat/:sessionId/messages` | — | `200 { "messages": [{ "sender": "user"\|"ai", "text": string, "createdAt": string }] }` |
| `GET` | `/health` | — | `200 { "status": "ok" }` |

Errors are always JSON `{ "error": string }`:

- `400` — empty/missing message, over the 4000-char cap, or malformed JSON.
- `413` — request body larger than the limit.
- `502` — the model provider was unavailable; the precise cause is logged server-side.

`GET /chat/:sessionId/messages` returns an empty list for an unknown session
rather than a 404, so the widget always restores cleanly.

---

## How the LLM layer works

**System prompt and context.** The system prompt is assembled at request time
from the agent's persona plus the FAQ rows in the database — store policies are
never hardcoded, so updating a policy is a data change (edit the seed or the
table), not a code change. History is trimmed to a **token budget** (not a fixed
message count) before being sent, so context stays within a known cost/size
ceiling regardless of how large individual messages are, and the reply length is
capped for the same reason.

**Resilience.** Each model call runs under a 30-second timeout (`AbortController`),
SDK retries are capped so a transient rate limit surfaces as a rate limit rather
than a confusing timeout, and every provider error is mapped to a typed
`LLMError` and shown to the user as a single friendly message.

**Logging.** Requests and errors are logged with structured (pino) logging — one
JSON line per request in production, with the level keyed off the status code
(5xx → error, 4xx → warn), request-id correlation, health-check noise excluded,
and auth headers redacted.

**Trade-offs.** OpenRouter adds a network hop and an external dependency, and free
models carry rate limits and can be rotated out — both acceptable here and cheap
to escape, since swapping providers or pinning a paid model is a one-file change.
In production you'd add provider fallback/retry routing, a circuit breaker,
response caching for common FAQs, and per-tenant model config.

---

## Tool calling

The agent can call tools for things the static knowledge base can't answer — like
a live order status. The flow is the standard agent loop:

```
user asks about ORD-1001
  -> model decides to call check_order_status({ orderId: "ORD-1001" })
  -> the tool runs and returns the order data
  -> the model writes a natural reply using that data
```

The one shipped tool, `check_order_status`, returns **mock** data for `ORD-1001`,
`ORD-1002`, and `ORD-1003` (see
[server/src/domain/tools/order-status.tool.ts](server/src/domain/tools/order-status.tool.ts)).
Swapping the mock for a real orders API wouldn't change anything else.

**To add a tool:** create a file exporting a `Tool` (`name`, `description`, a
JSON-Schema `parameters`, and an `execute` function) and add it to the registry in
[server/src/domain/tools/tool.ts](server/src/domain/tools/tool.ts). Both providers
pick it up automatically.

---

## Deployment

This project is deployed on free tiers (see [Live demo](#live-demo)):

- **Database — [Neon](https://neon.tech)** (serverless PostgreSQL). The app's
  `DATABASE_URL` uses the **pooled** connection string; migrations use the
  **direct** string (`DIRECT_URL`). The Prisma CLI is configured to prefer the
  direct URL, so `prisma migrate deploy` / `prisma db seed` are run once to set
  up and seed the database.
- **Backend — [Render](https://render.com)** (free web service):
  - Root directory: `server`
  - Build command: `npm install && npx prisma generate && npm run build`
  - Start command: `npm start`
  - Env vars in the dashboard: `DATABASE_URL` (Neon pooled), `OPENROUTER_API_KEY`,
    `OPENROUTER_MODEL`, `LLM_PROVIDER`, `NODE_ENV=production`, and `CORS_ORIGIN`
    set to the Vercel URL. (`PORT` is provided by Render automatically.)
- **Frontend — [Vercel](https://vercel.com)**: root directory `web`,
  `VITE_API_BASE_URL` set to the Render API URL.

**Free-tier cold start:** Render's free instance spins down after ~15 minutes of
inactivity, so the first request after idle takes ~30–60 seconds to wake the
server; every request after that is fast. Warm it by hitting `/health` first, or
keep it warm with an uptime pinger. See the note under [Live demo](#live-demo).

---

## Troubleshooting

- **Server won't start, "Invalid environment configuration"** — a required env var
  is missing. The message names it. Set it in `server/.env`.
- **`prisma migrate dev` fails with "permission denied to create database"** — the
  DB role needs `CREATEDB` for the migration shadow database: `ALTER ROLE livechat CREATEDB;`.
- **Every chat returns a 502** — the model provider is failing. Check the server
  logs for `LLM error [kind]`. `auth` = bad/empty key; `rate_limit` = throttled
  (wait or change model); `404` in logs = the model id no longer exists, pick another.
- **Browser shows a CORS error** — leave `CORS_ORIGIN` empty for local dev (it then
  accepts any localhost port), or set it to your exact frontend URL.
- **Port already in use** — another process holds `4000`/`5173`. Stop it, or set a
  different `PORT` (backend) / pass `--port` (Vite).
- **Changed `.env` but nothing changed** — env is read at startup; restart the
  server (`Ctrl+C`, then `npm run dev`).

---

## Trade-offs and next steps

- **Retrieval over the FAQ.** The FAQ set is small enough to put in the prompt; at
  scale, embed and retrieve only the relevant entries (RAG).
- **Streaming responses.** Server-sent events would replace the typing indicator
  with real token streaming.
- **More tools.** The order-status lookup shows the loop; returns, address changes,
  and a real orders API would slot into the same registry.
- **Direct Anthropic provider.** A drop-in third implementation selectable via
  `LLM_PROVIDER`, plus provider fallback/retry routing for availability.
- **Rate limiting and tests.** Per-session rate limiting, and unit tests around
  validation and a mocked provider.
- **Deeper observability.** Structured logging is in place; metrics and tracing
  (e.g. OpenTelemetry) would be the next step.
</content>
