# Streaming (SSE)

Server-sent events are the streaming primitive here. There are **two kinds** of
stream and they do not share an abstraction, because their failure rules are
opposites: one must resume, the other must never retry.

| Kind             | Example                    | Reconnects?        | Server               | Client                 |
| ---------------- | -------------------------- | ------------------ | -------------------- | ---------------------- |
| **Subscription** | notifications, live counts | yes, from a cursor | `$lib/server/sse.ts` | `$lib/event-stream.ts` |
| **Response**     | LLM tokens                 | **never**          | AI SDK (`ai`)        | AI SDK                 |

## Subscription streams

Long-lived, server-to-client, resumable. `sseResponse` owns the framing, the
headers, cancellation and cleanup so a route stays an adapter:

```ts
return sseResponse(
	async (send, open) => {
		for (let elapsed = 0; elapsed < STREAM_MAX_MS && open(); elapsed += POLL_MS) {
			for (const row of await rowsSince(ctx, actor, cursor)) {
				send({ id: row.id, data: row });
				cursor = row.id;
			}
			await new Promise((r) => setTimeout(r, POLL_MS));
		}
	},
	{ event: 'notifications.stream', onDone: () => ctx.close() }
);
```

- `send({ id, event?, data })` writes one frame; `data` is JSON-encoded.
- `open()` goes false the moment the client disconnects. **Any loop must check
  it** or the Worker keeps querying for a reader that left.
- `onDone` always runs, success or disconnect. That is where `ctx.close()` goes.

The rules that keep one honest:

- **Every frame carries an id, and the id is the cursor.** That is what makes a
  reconnect resumable: the browser sends it back as `Last-Event-ID`. On
  (re)connect the notifications route resolves the starting cursor in order -
  `Last-Event-ID`, then `?since`, then the newest row's id when neither parses to
  a number - and the inbox endpoint returns that same cursor (the newest row it
  actually listed, not a separate max-id query) so no row can slip between the
  list snapshot and the stream.
- **Bound the connection** (notifications: ~5 min) and let the client reconnect.
  A stream that lives forever is a stream you cannot deploy past.
- **Poll `ctx.db`, never `ctx.dbCached`** - a 60s-stale read defeats the point.
- One query per tick per connected client. That is the bill: see below.

On the client, `eventStream` is the one home:

```ts
const stream = eventStream({
	url: () => `/app/notifications/stream?since=${cursor}`,
	onMessage: (data) => handle(JSON.parse(data)),
	onLost: () => showError(m.notifications_offline())
});
```

`EventSource` already retries a **dropped** connection and resumes from
`Last-Event-ID`. What it never retries is a **response** it dislikes - a 401 once
the session expires, a 5xx while the backend is down - so `eventStream` adds
exactly that: reopen on a backoff (1s, 2s, 5s, 15s, 30s), rebuilding the URL each
attempt so the cursor is current, `onLost` when they run out, and a free retry
when the browser fires `online`. Surface `onLost` as an error toast
(`$lib/toasts.svelte.ts`), never silence.

## Response streams (LLM)

An AI completion is request-scoped and single-use. **Do not route it through
`eventStream`**: a reconnect re-runs the prompt, doubles the bill, and produces a
second answer. It also cannot use `EventSource` at all - that API is GET-only
with no custom headers, and a prompt is a POST body.

Use the AI SDK, already a dependency (`ai` + `workers-ai-provider`): `streamText`
on the server returns a streaming `Response` directly, and its client bindings own
the read side. `sseResponse` is not involved. AI surfaces additionally owe the
user an `AiDisclosure` (docs/ai-compliance.md).

## Why this is hand-written and not a library

Checked, as of August 2026:

- **`@microsoft/fetch-event-source`** - the closest thing to a standard client.
  Last published 2.0.1 in **April 2021**, repo archived.
- **`reconnecting-eventsource`** - maintained, but retries **forever** with a
  random delay under 3s and no give-up hook, so a down backend gets hammered and
  the user is never told. It also appends `lastEventId` as a query parameter this
  app does not read.
- Server-side SSE producers are either framework-bound (Hono's `streamSSE`) or
  Node-only (`better-sse`); neither fits SvelteKit on workerd.

The gap is ~45 lines across two files, both tested, so that is what this is. The
one place a library **is** correct is the LLM path, and that library is the AI SDK.

## What it costs

One query per connected client per `POLL_MS` (2.5s for notifications, so 0.4
queries/second each). Awaiting I/O costs 0 CPU-ms and Workers bills CPU rather
than wall clock, so the open connection itself is nearly free - the bill lands on
Postgres, so the poll must be an index lookup: `notification` carries
`notification_user_id_id_idx` on `(user_id, id)`, which serves both the cursor
poll and the newest-id lookup. Postgres does not index foreign keys for you - a
new subscription stream needs its own index on whatever its poll filters by.

Every stream logs `<event>.open` and `<event>.close` (with `frames`, `ms` and
`cancelled`, plus whatever `fields` the caller passes). Open minus close is the
live connection count, and Workers Logs indexes those JSON fields.

For **client-to-client** or sub-second bidirectional state, no amount of SSE
helps - that needs WebSockets and a stateful server. See [realtime.md](realtime.md).
