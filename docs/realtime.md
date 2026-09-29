# Realtime (stateful / WebSockets)

Presence, chat, collaborative editing, live dashboards - anything stateful - needs **Durable Objects**. They're allowed and previewable here now ([Worker Previews](deploy.md)), but two release-model constraints survive: a version that adds or changes a DO class must ship via `wrangler deploy`, not `deploy:canary` / `wrangler versions upload`, and you **cannot roll back across** a DO migration (see [deploy.md](deploy.md) and [cloudflare.md](cloudflare.md)). To keep _this_ app on the full canary + rollback model, the recommended pattern is a **sidecar**: this app authorizes and mints a short-lived signed token; a separate stateful worker owns the Durable Object and the WebSocket and verifies the token. No shared session, no shared database - the two workers only share one secret.

Notifications (SSE, [notifications.md](notifications.md)) cover server-→-client push without any of this, and [streaming.md](streaming.md) is the general rule for streams. Reach for a sidecar only when you need _client-→-client_ or _sub-second, bidirectional_ state. **Nothing in this app depends on it** - the sidecar is opt-in, and the app ships with no WebSocket client.

## The handoff

```
browser ──POST /app/realtime/token──▶  this app   (authorizes, HMAC-signs {sub, room, exp})
   │                                      │
   │  ◀───────── { token, url } ──────────┘
   │
   └──wss://<PUBLIC_REALTIME_URL>?token=…──▶  sidecar worker  (verifies signature, no DB)
                                                 └─ Durable Object per room: sockets, presence, broadcast
```

The capability is the **token**: possessing a validly-signed, unexpired token _is_ the authorization. The sidecar never calls back to this app or the database - it just verifies the HMAC with the shared `REALTIME_SECRET`. That's what makes it safe to run a Durable Object in a _different_ worker without leaking sessions across the boundary.

## What ships in this app (the authorizing half)

- **`$lib/server/realtime/service.ts`** - `mintRealtimeToken(ctx, env, actor, orgId, room)` runs `requireMember` (real authorization against the DB), then signs `{ sub, room: "<orgId>:<room>", exp }` with `REALTIME_SECRET`. The room is org-prefixed so a token can't be replayed against another tenant. `verifyRealtimeToken(secret, token)` is the mirror the sidecar runs - exported here so the handoff is unit-tested in the same runtime (`service.spec.ts`).
- **`POST /app/realtime/token`** - the thin route: resolve identity, mint, return `{ token, url, room }`.
- **Client** - fetch a token, then open the socket:

  ```ts
  const res = await fetch('/app/realtime/token', {
  	method: 'POST',
  	headers: { 'content-type': 'application/json' },
  	body: JSON.stringify({ room: 'notes' })
  });
  const { token, url } = await res.json();
  const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
  ```

Tokens live ~60s - just long enough to hand off and open the socket. The socket itself is long-lived; only the _handshake_ needs the token.

## The sidecar worker (the stateful half)

A second, self-contained Worker - its own repo or a `realtime/` directory with its own `wrangler.jsonc`. Do not hand-roll the socket plumbing: **partyserver** (`partyserver`, maintained by Cloudflare since the PartyKit acquisition) wraps a Durable Object with lifecycle hooks, broadcast and the Hibernation API, and **partysocket** is its reconnecting client. Both work standalone.

```ts
// realtime/src/index.ts - the sidecar.
import { routePartykitRequest, Server, type Connection, type ConnectionContext } from 'partyserver';
import { verifyRealtimeToken } from './token'; // shared with the app - see below

export class Room extends Server<Env> {
	// Sleeps between messages without dropping sockets, so idle rooms bill nothing.
	static options = { hibernate: true };

	async onConnect(connection: Connection<{ sub: string }>, ctx: ConnectionContext) {
		const token = new URL(ctx.request.url).searchParams.get('token') ?? '';
		const claims = await verifyRealtimeToken(this.env.REALTIME_SECRET, token);
		if (!claims || claims.room !== this.name) return connection.close(1008, 'unauthorized');
		// Hibernation resets instance fields; per-connection state must live here.
		connection.setState({ sub: claims.sub });
	}

	onMessage(connection: Connection, message: string) {
		this.broadcast(message, [connection.id]);
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const claims = await verifyRealtimeToken(
			env.REALTIME_SECRET,
			url.searchParams.get('token') ?? ''
		);
		if (!claims) return new Response('unauthorized', { status: 401 });

		// partyserver routes /parties/:namespace/:name, so the room comes from the URL.
		// Without this check a token minted for one tenant opens any other tenant room.
		if (decodeURIComponent(url.pathname.split('/').pop() ?? '') !== claims.room) {
			return new Response('forbidden', { status: 403 });
		}
		return (await routePartykitRequest(request, env)) ?? new Response('not found', { status: 404 });
	}
};
```

```jsonc
// the sidecar's wrangler.jsonc
{
	"name": "myapp-realtime",
	"main": "src/index.ts",
	"compatibility_date": "2026-07-10",
	"durable_objects": { "bindings": [{ "name": "Room", "class_name": "Room" }] },
	"migrations": [{ "tag": "v1", "new_sqlite_classes": ["Room"] }]
}
```

On the client, let partysocket own reconnection. Tokens live ~60s but the socket does not, so pass a **url provider** rather than a string - it is called per attempt, and every reconnect mints a fresh token:

```ts
import { WebSocket } from 'partysocket';

const socket = new WebSocket(async () => {
	const res = await fetch('/app/realtime/token', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ room: 'notes' })
	});
	const { token, url, room } = await res.json();
	return `${url}/parties/room/${encodeURIComponent(room)}?token=${encodeURIComponent(token)}`;
});
```

**Share the token module, do not copy it.** Move `verifyRealtimeToken` and its helpers into a file with no SvelteKit, env or database imports, and import that same file from both sides. A copied signature check is a copy that will one day disagree with the original.

## Setup

1. **One shared secret.** `wrangler secret put REALTIME_SECRET` on **both** workers (same value) - locally, add it to each `.dev.vars`. It's the whole trust boundary; rotate it on both at once.
2. **Deploy the sidecar**, then set `PUBLIC_REALTIME_URL` (a var in this app's `wrangler.jsonc`) to its `wss://…` URL and redeploy this app.
3. **Custom domain:** the sidecar's `*.workers.dev` URL **dies when you move to a custom domain** - repoint `PUBLIC_REALTIME_URL` (and give the sidecar its own `routes` custom-domain seam) then redeploy. This is one of the cross-origin URLs [deploy.md](deploy.md#custom-domain-as-code) warns you to rewire.
4. **CI:** the sidecar is a **second `wrangler deploy`** - add it to the deploy job (or a deploy matrix), or it drifts out of sync with the app. CI ships the app only by default.

## Keep it a deletable reference

Like `todos` and `notes`, this is a pattern to learn from, not a foundation. If you don't need realtime, delete `$lib/server/realtime/` and `src/routes/app/realtime/` - nothing else depends on them, and `PUBLIC_REALTIME_URL` / `REALTIME_SECRET` stay unset (the mint route just 500s if called, which nothing does).
