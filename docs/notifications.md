# Notifications

Real-time in-app notifications: a persistent inbox (bell + unread + history) with live toasts, plus "refresh" signals that tell the client to refetch. Delivery is **SSE**, not WebSocket - stateful WebSockets on Workers need Durable Objects, which this template keeps in a sidecar Worker to preserve the canary/rollback release model (they are previewable now via Worker Previews). See [cloudflare.md](cloudflare.md).

## Shape

`notification` table → service (`notify` / `notifyOrg`) → SSE endpoint that polls `ctx.db` → a client store (`$lib/notifications.svelte.ts`) → the bell + toasts in the app shell. A notification's integer id doubles as the SSE cursor.

## Sending one

From any server code that has run its own authorization:

```ts
import { notify, notifyOrg } from '$lib/server/notifications/service';

// One user:
await notify(ctx, userId, { bodyKey: 'notif_note_created', params: { title } });

// Every member of an org (skip the actor):
await notifyOrg(ctx, orgId, {
	bodyKey: 'notif_note_created',
	params: { title },
	except: actor.id,
	href: '/app/notes'
});
```

Send it post-response via `ctx.waitUntil(...)` when the notification isn't part of the action's result - the way `createNote` does.

## Two kinds

- **`message`** (default) - shown as a toast and stored in the inbox. It carries a Paraglide **key + params**, never a rendered string, so the client renders it in the recipient's current UI locale (`renderNotification`). Adding one is three edits: the string in `messages/*.json`, the key in the `NotifBodyKey` union (`$lib/notifications.ts`), and its entry in the `BODY` map (`$lib/notifications.svelte.ts`), which names the params it renders. TypeScript fails the build if you skip either of the last two - and the map exists because a dynamic `m[key]` lookup would defeat Paraglide tree-shaking and ship every message in the app to the browser. Optional `href` makes it clickable.
- **`refresh`** - not shown. Tells the client to invalidate data and refetch. With `params.invalidate` set to a `depends(...)` key, only loads that declared that key re-run; without it, the client does a full `invalidateAll()`.

Example - a new note tells other members both things: a `message` ("New note: …") and a `refresh` targeting `app:notes`, so their open notes list refetches. The notes load opts in with `depends('app:notes')`.

## Delivery

The store fetches the inbox once (`GET /app/notifications`), then opens the stream through `eventStream` (`$lib/event-stream.ts`). The endpoint is a thin adapter over `sseResponse` (`$lib/server/sse.ts`), the shared primitive every subscription stream uses - see [streaming.md](streaming.md). It polls `ctx.db` (never `dbCached`) for rows past the cursor and sends each with its id; a dropped connection is retried by `EventSource` itself and resumes from `Last-Event-ID`, so nothing is missed. Each connection is bounded (~5 min) and the loop stops on client disconnect (`cancel`). One open stream is one request - well under the rate limit.

Reads are owner-scoped in the service, so a user only ever sees, streams, or marks their own notifications. Nothing prunes them yet - the maintenance cron only clears expired sessions and verifications; to cap the table, extend `purgeExpired` to delete old rows.

## When it breaks

`EventSource` only retries a **dropped** connection. A **response** it does not like (a 401 once the session expires, a 5xx while the backend is down) closes it for good, which is why the stream goes through `eventStream`: it reopens on a backoff (1s, 2s, 5s, 15s, 30s), rebuilding the URL each time so the cursor is current, and calls `onLost` when those run out. The store turns that into one error toast (`notifications_offline`) and reconnects by itself if the browser fires `online`.

Marking read is optimistic and reverts when the write fails - only the rows it flipped, so a notification that arrived mid-flight survives - plus a generic error toast. Toasts are `$lib/toasts.svelte.ts` (`showToast` / `showError`), rendered once by `components/Toasts.svelte` in the app shell; anything client-side that fails in front of a user belongs there, with a Paraglide message.
