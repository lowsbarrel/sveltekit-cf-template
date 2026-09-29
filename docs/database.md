# Database

Postgres through Hyperdrive, Drizzle as the ORM, migrations as committed artifacts. How to model data is covered step by step in [adding-features.md](adding-features.md); this page is the infrastructure and the sharp edges.

## How the pieces connect

Postgres reaches the Worker through [Hyperdrive](https://developers.cloudflare.com/hyperdrive/), which pools connections at the edge - the app reads the binding's `connectionString` and speaks standard Postgres via `postgres.js`, so any provider works. Locally, `wrangler.jsonc`'s `localConnectionString` points at the compose database; no Cloudflare account needed for dev or tests.

**Recommended production Postgres: [Neon](https://neon.com).** `bunx neonctl@latest init` runs a guided bootstrap - auth, project creation, a `DATABASE_URL` for CI migrations, plus the Neon MCP bridge and agent skills for your editor. Feed its connection string to `wrangler hyperdrive create` (see [deploy.md](deploy.md#first-time-provisioning-cli)). Neon's copy-on-write branches pair naturally with this template: a `staging` branch rehearses migrations before `main`, and PR-scoped branches are one CLI call if previews ever need isolated data.

## Query caching - read before creating the Hyperdrive config

Hyperdrive [caches read query results by default](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/) (60s `max_age`) and **never invalidates on writes** - with a default config, a deleted session could still authenticate for up to a minute. The template therefore uses two bindings to the same database:

- `ctx.db` ← `HYPERDRIVE` - create with `--caching-disabled`. Always fresh; everything auth-related and read-after-write uses this. The default.
- `ctx.dbCached` ← `HYPERDRIVE_CACHED` (optional, commented in `wrangler.jsonc`) - plain config with caching on, for hot reads that tolerate ~60s staleness: public content, dashboards, counts. Until you bind it, `ctx.dbCached` falls back to `ctx.db`, so services can adopt it before the infrastructure exists.

One production gotcha: **Hyperdrive only connects to origins that speak TLS**. Hosted Postgres (Neon, Supabase, RDS) does out of the box; a self-hosted database - including one reached through a Cloudflare Tunnel - needs server certificates configured before Hyperdrive will talk to it.

## Migrations

Flow: change `src/lib/server/db/schema.ts` → `bun run db:generate` → `bun run db:migrate`. Migrations live in `drizzle/` and are committed - never edit them by hand. In CI, the deploy job applies them to production (`DATABASE_URL` secret) **before** shifting traffic.

### Indexes on a populated table

All pending migrations run inside **one transaction**, and Postgres refuses `CREATE INDEX CONCURRENTLY` inside a transaction block - a generated `CREATE INDEX` therefore takes an ACCESS EXCLUSIVE lock and blocks writes while it builds. That is nothing on an empty table and an outage on a large one. For a big table, build it by hand first and let the migration no-op:

```sql
CREATE INDEX CONCURRENTLY "notification_user_id_id_idx" ON "notification" ("user_id", "id");
```

The committed migration is written `CREATE INDEX IF NOT EXISTS` so it stays correct either way: a no-op in production once the concurrent build finished, a plain create in dev and CI where the table is empty. This is the one sanctioned reason to touch a generated migration.

Every new table must also be added to the truncate list in `tests/isolate-db.ts` - a missing table leaks rows between tests and between runs, and a table with no foreign key is not reached by `CASCADE`.

## Money and precision

Postgres `numeric` reaches the driver as a string - use `decimalNumeric` from `$lib/server/db/types.ts` (round-trips through decimal.js) instead of floats, for money and any precise quantity.

## Local Postgres gotcha

Two apps built from this template can't run their compose databases at once - both bind host port **5432**, and tests/E2E will silently talk to whichever container owns it (wrong schema → confusing 500s). For side-by-side projects, change the port in `compose.yaml`, `drizzle.config.ts`'s fallback URL, and `wrangler.jsonc`'s `localConnectionString`.

## Latency

Three levers, in the order to pull them (learned in production on the first template-derived app):

1. **Request shape first.** Layout loads fetch in one parallel round, trusting optimistic context like the session's active org (services re-verify membership - a stale id just falls back to the slow path), and don't track `url`, or every navigation re-runs every sidebar query. These are AGENTS.md invariants; they matter more than any infrastructure setting.
2. **Cookie-cached sessions.** better-auth's `session.cookieCache` (commented seam in `auth.ts`) eliminates the per-request session query - usually the single hottest query in the app. Trade-off: revocation (sign-out elsewhere, member removal) propagates only when the cookie expires; mutations remain database-authorized regardless.
3. **Smart Placement.** Commented seam in `wrangler.jsonc`. Postgres clients are per-request on Workers, so a request chaining N queries crosses the worker↔database distance N times but reaches the user once - when N is large, running near the database beats running near the user, and Cloudflare relocates automatically based on measured traffic. Pull levers 1-2 first: they shrink N, and afterwards placement may correctly decide the edge is already optimal.

Also budget for your database's cold starts (e.g. Neon's free tier suspends after idle - the first request after a pause pays it back). The one real-time feature that ships - SSE notifications - polls `ctx.db`, so these levers apply to it too; only a genuinely typing-latency path would move to WebSockets in a second worker (Durable Objects, [cloudflare.md](cloudflare.md)) and leave Postgres out of the loop entirely.
