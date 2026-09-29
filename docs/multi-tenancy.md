# Multi-tenancy

How this template keeps one customer's data away from another's: application-layer isolation as the primary mechanism, Row-Level Security as a defense-in-depth backstop, and the plan system for per-tenant limits.

## The tenancy model

**The organization is the tenant.** Every paid entitlement, every shared resource, and every membership hangs off an `organization` row. Signup auto-creates a personal org (`auth.ts`), so even a solo user is already a tenant of one - there is no "no-org" state to special-case. A user can belong to several orgs; the session carries an `activeOrganizationId` naming the one they're currently acting in.

That id on the session is an **optimistic hint, not an authorization**. It is convenient for a route to read, but a service never trusts it: `requireMember` / `requirePermission` reload membership and role from the database on every call (`$lib/server/orgs/service.ts`). A forged or stale `activeOrganizationId` buys nothing - the database is the authority.

## Application-layer isolation (the primary mechanism)

Isolation is enforced in the service layer, which is the single choke point every request funnels through (routes are adapters; see [architecture.md](architecture.md)). Three things combine:

1. **Actor scoping.** The `Actor` (`{ id }`) is derived from `locals.user` by the route, never from the request body. Services receive it and scope by it.
2. **DB-loaded membership + role.** For org-owned resources, the service calls `requireMember` (read) or `requirePermission(ctx, actor, orgId, { note: ['create'] })` (write) before touching data. Both load the `member` row from the database; `requirePermission` additionally runs the pure `can()` check from `$lib/permissions.ts`. A role claimed by the client is never trusted ([auth.md](auth.md#organizations--permissions)).
3. **Query scoping.** Every query carries `where organization_id = <orgId>` (or `where user_id = <actor.id>` for user-owned rows). A row in another tenant is indistinguishable from a row that doesn't exist - a cross-tenant read returns nothing, a cross-tenant write reports `not_found`.

This is the mechanism the tests actually prove (`src/lib/server/notes/service.spec.ts`): a member of org B, even with the right role in their own org, cannot read, update, or delete org A's notes.

### User-scoped vs org-scoped: which to use

Two worked examples ship, and the choice between them is a modeling decision:

|                 | User-scoped (`todo`)                                          | Org-scoped (`note`)                                            |
| --------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| Owner column    | `user_id` → `user`                                            | `organization_id` → `organization`                             |
| Authorization   | actor scoping IS the check - owning the row is the permission | `requireMember` / `requirePermission` + role, then org scoping |
| Visibility      | private to the one user                                       | shared across everyone in the org                              |
| Permissions     | none needed                                                   | vocabulary in `$lib/permissions.ts`, granted per role          |
| Example service | `$lib/server/todos/service.ts`                                | `$lib/server/notes/service.ts`                                 |

Use **user-scoped** when a row belongs to exactly one person and no teammate should see it (drafts, personal settings). Use **org-scoped** when the resource is shared by the team and access depends on a role (shared documents, projects, anything an admin manages on everyone's behalf). Billing is org-scoped for exactly this reason: every member inherits the entitlement, but only owners and admins can change the plan.

Adding either kind is the [adding-features.md](adding-features.md) recipe; the org-scoped extras (permission vocabulary, `requirePermission`) are step 6 there.

## Pool vs silo

This template is a **shared-schema pool**: all tenants live in one database, one set of tables, isolated by the `organization_id` column and the service layer above it. This is the cheapest model to run and the simplest to migrate - one `bun run db:migrate` touches every tenant at once - and it is the right default for the overwhelming majority of SaaS apps.

The alternative, a **silo** (a database or schema per tenant), trades that simplicity for stronger blast-radius isolation and per-tenant backup/restore. This template does not wire this up, but the seams are friendly to it: `Ctx` already owns connection creation (`$lib/server/ctx.ts`), so a per-tenant connection string is a change in one place rather than a scatter through the codebase. If you go there, **[Neon](https://neon.com)'s copy-on-write branches** are the natural fit - a branch per tenant is one CLI call, and the template already recommends Neon for production ([database.md](database.md#how-the-pieces-connect)). Treat this as a future option, not a starting point: pool until a concrete requirement (a regulated customer, a noisy-neighbor problem) forces a silo.

## Per-tenant limits

Quotas are per-organization and live in the plan catalog (`$lib/plans.ts`), enforced with `requireWithinLimit(ctx, env, orgId, key, currentCount)` before a write. The free plan caps a resource; paid tiers raise or lift it. `addTodo` is the worked example, and [plans.md](plans.md) is the full walkthrough for adding a limit or a tier. Because limits key off the org, they are a tenancy control as much as a billing one: one tenant cannot exhaust another's allowance.

## RLS: defense in depth

Application-layer isolation is correct on its own. Row-Level Security is a **second wall** on top of it, on the `note` table only - so that a future bug that forgets a `where organization_id = …` clause fails closed (returns nothing) instead of leaking across tenants.

### How `withTenant` works

`$lib/server/tenant.ts` exports one helper:

```ts
export function withTenant<T>(ctx, orgId, fn: (tx) => Promise<T>): Promise<T> {
	return ctx.db.transaction(async (tx) => {
		await tx.execute(sql`select set_config('app.current_org_id', ${orgId}, true)`);
		return fn(tx);
	});
}
```

It opens a transaction, sets the `app.current_org_id` GUC, and runs the callback against the transaction. The RLS policy on `note` reads that GUC:

```sql
CREATE POLICY "note_tenant_isolation" ON "note" AS PERMISSIVE FOR ALL TO public
	USING      (organization_id = current_setting('app.current_org_id', true))
	WITH CHECK (organization_id = current_setting('app.current_org_id', true));
```

`USING` filters what rows are visible/updatable/deletable; `WITH CHECK` rejects an insert or update that would place a row outside the current tenant. With no GUC set, `current_setting(..., true)` returns NULL and **no rows match** - the policy fails closed. The notes service routes every query through `withTenant`, so notes get both the app-layer `where` and the RLS backstop.

### Why the context must be transaction-local

The GUC is set with `set_config(..., true)` - the third argument is `is_local`, meaning the setting lives and dies with the current **transaction**, never the session. This is mandatory under Hyperdrive: `postgres.js` connections are pooled (`max: 5`) and reused across requests, so a session-level `SET app.current_org_id` would leak one tenant's context onto the next request that borrows the same socket - the exact cross-tenant bug RLS is meant to prevent. A transaction-local setting is reset when the transaction ends, so it cannot leak. **Never** use a plain `SET`; always go through `withTenant`.

### The critical superuser caveat

**Postgres superusers bypass RLS entirely** - even `FORCE ROW LEVEL SECURITY` doesn't stop them. The local and test databases (`compose.yaml`) connect as the `postgres` superuser, so **RLS is silently inert in local dev and in the test suite on the normal path.** Two consequences:

- **RLS is not relied on for correctness.** The app-layer `where organization_id = …` scoping is the real guard and works regardless of connection role. RLS only ever adds safety; it never subtracts it. This is why the app keeps both.
- **Production must connect as a non-superuser role for RLS to mean anything.** Owners _also_ bypass a plain `ENABLE ROW LEVEL SECURITY` - and on Neon (and most hosted Postgres) migrations run as the table owner, so out of the box the policy would be decoration. Migration `0008` therefore sets `ALTER TABLE note FORCE ROW LEVEL SECURITY`, which makes the owner obey the policy too. That leaves exactly one production requirement: **the runtime role must not be a superuser** (superusers bypass RLS even with `FORCE`). On Neon the default role isn't a superuser, so this comes for free - verify with `SELECT rolsuper FROM pg_roles WHERE rolname = current_user;`. For least privilege, a dedicated role:

  ```sql
  CREATE ROLE app_runtime NOSUPERUSER;
  GRANT USAGE ON SCHEMA public TO app_runtime;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
  ```

  Point the production connection string (the one behind Hyperdrive) at `app_runtime`, and RLS enforces.

The RLS _policy_ (migration `0004`) and its `FORCE` (migration `0008`) are both committed, so they apply everywhere the migrations run. Role creation is deliberately **not** in a migration: `CREATE ROLE` is cluster-scoped and provider-specific, and running it against Neon/production from `drizzle/` would be fragile or fail - provisioning the _role_ is the one-time production step, done here.

### What the tests verify (and what they can't)

`src/lib/server/notes/rls.spec.ts` proves the policy genuinely enforces, by working around the superuser bypass: it creates a `NOSUPERUSER` role at test time (via the superuser connection, which is allowed to), then `SET LOCAL ROLE`s into it inside a transaction. RLS applies to the switched-in role, so the test can show:

- with the GUC set to org A, only A's rows are visible; setting it to org B hides A's and shows B's;
- with no GUC set, nothing is visible (fails closed);
- an insert that would place a row in another tenant is rejected by `WITH CHECK`;
- and, as a documented control, the **superuser connection sees everything** regardless of context - the caveat above, asserted rather than assumed.

What the tests **cannot** verify is the production wiring itself - that your deployed connection string uses a non-superuser role. That is a deployment-time property, not something the workerd test harness (which only has the superuser Hyperdrive binding) can observe. Verify it in production with the `pg_roles` query above.

### Extending RLS to another table

RLS here is opt-in per table, not global - retrofitting it onto the auth/session/billing tables would break login and existing flows, so those deliberately have none. To add it to a _new_ org-scoped table:

1. Give the table an `organization_id` column (FK to `organization`, `onDelete: 'cascade'`).
2. Attach a policy in `schema.ts`, mirroring `note` - a `pgPolicy` in the table's config keyed on `current_setting('app.current_org_id', true)`. drizzle-kit emits the `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` SQL into a generated migration, so the "migrations are generated, never hand-edited" invariant holds (verified: drizzle-orm 0.45.2 + drizzle-kit 0.31.10 support this).
3. Route **every** query for that table through `withTenant`, and keep the app-layer `where organization_id = …` too. RLS without `withTenant` sets the context to NULL and hides all rows; the app-layer `where` without RLS is the primary guard. You want both.

## Authorizing from the row (share links, deep links)

Both shipped examples pass the tenant in explicitly - `listNotes(ctx, actor, orgId)` always knows the org up front. But some resources are reached by an **opaque id without the viewer's org context**: a note opened from a share link, an invitation, a public document. That shape fights RLS head-on - you can't `withTenant(orgId, …)` when finding the row is _how_ you'd learn the org, and under the `FORCE`d policy a lookup with no `app.current_org_id` set returns nothing.

The resolution is to make the opaque id a **capability that carries the org** - the same signed-token trick as [realtime.md](realtime.md) (`$lib/server/realtime/service.ts`). The link isn't the row's primary key; it's a token you HMAC-signed that says `{ resourceId, orgId, exp }`. Possessing a valid token _is_ the authorization - no org membership required, which is the whole point of a share link - and because the token carries the org, you can set the tenant context _before_ the lookup:

```ts
// mint - an org member creates the link: authorize, then sign the capability
// (HMAC over the claims, exactly like mintRealtimeToken in realtime/service.ts).
export async function createShareLink(ctx, env, actor, orgId, noteId) {
	await requireMember(ctx, actor, orgId);
	return signCapability(env.SHARE_SECRET, { noteId, orgId });
}

// open - anyone with the link: verify, then thread the org through withTenant
export async function openSharedNote(ctx, env, token) {
	const cap = await verifyCapability(env.SHARE_SECRET, token); // like verifyRealtimeToken
	if (!cap) return null;
	return withTenant(ctx, cap.orgId, (tx) =>
		tx
			.select()
			.from(note)
			.where(and(eq(note.id, cap.noteId), eq(note.organizationId, cap.orgId)))
	).then((rows) => rows[0] ?? null);
}
```

Two things keep it safe: the token is **signed**, so a stranger can't forge `{ noteId, orgId }` for a resource they were never granted; and you keep the **app-layer `where organization_id = …`** using the org _from the token_, so a mismatched token can't cross tenants even with RLS off. The capability replaces "is this actor a member?" with "did someone with authority mint this?" - which is exactly what a share link means.

Don't reach for this when explicit org scoping works. It's for the genuinely orgless entry points (share/deep links, invites) - the missing third shape alongside user-scoped (`todos`) and member-scoped (`notes`).

## Trade-offs, honestly

- Shared-schema pool means a schema migration is all-or-nothing across tenants, and a catastrophic app-layer bug could in principle touch multiple tenants' rows in one query - which is precisely why the RLS backstop exists on the shared resource.
- RLS costs a transaction per notes operation (`withTenant` wraps each in one) and is inert exactly where it would be most convenient to test (local superuser). It earns its keep only in production, and only if you connect as a non-superuser - a step easy to forget, which is why it's called out here and in [AGENTS.md](../AGENTS.md).
- The template stops at pool + RLS. Hard multi-tenant isolation (per-tenant databases, per-tenant encryption keys) is a real requirement for some buyers and is intentionally left as a documented extension rather than half-built.
