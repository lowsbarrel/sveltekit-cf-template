---
name: add-feature
description: Add a feature to this template end to end - database model, service, route adapter, UI, and tests - with authorization, rate limits, validation, and tests handled, and placed exactly where the architecture expects. Clarifies real product decisions with the user before building. Includes the durable-execution (Cloudflare Workflows) + live-progress (SSE) variant. Use when asked to build/add a feature, a background job, a multi-step process, or a real-time UI.
---

# Add a feature

The project lives in `app/` - project paths (`src/...`, `$lib/...`, `tests/...`,
`wrangler.jsonc`) are relative to `app/`, and every command runs from `app/`.

Build it so it's production-ready by default: correct placement, authorization, rate limits,
validation, and tests - following the invariants in [AGENTS.md](../../../AGENTS.md) (**route
adapter → service → database**; logic and authorization live in the service; validation
derived from the Drizzle table; failures are `AppError`s converted with `httpError`; UI
strings via Paraglide). Reuse existing services/helpers before writing new ones.

## Clarify first - ask, don't guess

The user knows the product; you know the code. When the request leaves any of these open and
you can't infer it safely, **ask the user** (`AskUserQuestion`) rather than pick for them -
each one changes what you build:

- **Who is allowed to do this?** → actor-scoping (owning the row is the permission, like
  `todos`) vs an org role check via `requirePermission` (like `notes`). If it's a new
  capability, add a statement to `$lib/permissions.ts`.
- **Is the data one user's, or shared by the whole organization?** → user-scoped vs
  org-scoped table (`organization_id`). See [docs/multi-tenancy.md](../../../docs/multi-tenancy.md).
- **Public or signed-in?** → prerendered `src/routes/(marketing)/` vs behind the auth
  boundary in `src/routes/app/`.
- **Does it cost money or consume a quota?** → a plan limit via `requireWithinLimit`
  (drive the **`add-plan`** skill for the limit itself).
- **Does it email a caller-chosen address, call a third party, or do slow/multi-step
  work?** → it needs a rate limit, and possibly a Workflow + SSE (below).
- **Is it destructive or irreversible?** → confirm in the UI; consider a soft delete.

State the assumptions you did make, so the user can correct them.

## Build it

Full worked walkthrough (real code from `todos`): [docs/adding-features.md](../../../docs/adding-features.md). In short:

1. **Model** - table in `src/lib/server/db/schema.ts` (singular snake_case, spread
   `timestamps`, foreign-key scope). `bun run db:generate` + `bun run db:migrate`, **and add the
   table to `tests/isolate-db.ts`**.
2. **Service** - `$lib/server/<feature>/service.ts`: `drizzle-zod` validation, `(ctx, actor,
…)` functions, authorization inside (actor/org scoping or `requirePermission`), `AppError`
   for failures. Metered? `requireWithinLimit`.
3. **Route adapter** - thin `+page.server.ts` / `+server.ts`: resolve identity, `createCtx`,
   call the service, `catch (e) { httpError(e); }`.
4. **UI** - `+page.svelte` with superforms; strings via `m.*()` (add to `messages/en.json` +
   `bun run i18n:compile`).
5. **Tests** - `service.spec.ts` (in workerd, **including the authorization / cross-tenant
   case**) + `validation.spec.ts` (fast-check).

## Production-readiness pass (before you call it done)

- [ ] Authorization is in the **service**, not the route (actor/org scoping or `requirePermission`)
- [ ] Input is validated with a schema **derived from the table** (`drizzle-zod`)
- [ ] A **rate limit** guards any public or expensive endpoint (`RATE_LIMITER` binding →
      `AppError('rate_limited', …)`); mail-to-a-stranger endpoints get a strict custom rule
- [ ] Metered resources call `requireWithinLimit` (`limit_reached` → 402)
- [ ] Failures are `AppError`s; the route converts with `httpError`
- [ ] User-facing text goes through Paraglide (no hardcoded strings)
- [ ] The new table is in `tests/isolate-db.ts`; migrations are **generated**, not hand-edited
- [ ] The authorization test exists and passes
- [ ] `bun run lint && bun run check && bun run test` are green

When it's green, land it through a branch + PR (AGENTS.md "Git & PRs") so CI gates
it - don't commit to `main` unless the user asks.

## Long-running work (durable execution + live progress)

Slow, multi-step, retryable, or scheduled work - reports, uploads, slow APIs - is a
**Cloudflare Workflow** with progress streamed over **SSE** (short request, idempotent
retries, no Durable Objects). **Read [references/durable-execution-sse.md](references/durable-execution-sse.md)**
for the full blueprint (job table → idempotent Workflow → DB-polling SSE endpoint →
`EventSource` UI) and adapt it. Key constraints: steps orchestrate only and must be
idempotent (fresh `Ctx` each); the SSE endpoint polls `ctx.db` (never `dbCached`); enable the
`workflows` binding + `bun run cf-typegen` + re-export from `src/worker.ts` and re-check preview
URLs; never `s-maxage` an authenticated SSE route. For LLM token streaming, use the AI SDK's
`toUIMessageStreamResponse()` instead ([docs/cloudflare.md](../../../docs/cloudflare.md#ai-opt-in)).
