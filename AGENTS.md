# Code organization

Keep the codebase clean by giving each thing **one home** and reusing it - never
restating a fact that already lives somewhere. Read this before adding a file,
and search for an existing home before creating a new one.

The SvelteKit project lives in `app/`; the repo root holds only `docs/`,
`.agents/skills/`, `.github/`, `.githooks/`, `.vscode/`, `media/`, the READMEs,
`AGENTS.md`, `.mcp.json`, the dotfiles and `LICENSE`. All
commands run from `app/`, and paths below are relative to it unless they start
at the repo root.

## The shape

Every request is **route adapter → service → database**. The adapter is thin -
resolve identity, build a `Ctx`, call a service, convert errors with
`httpError` - and holds no logic. The service holds all logic and authorization.
Non-HTTP work (cron, queues, workflows) enters through `src/worker.ts` with the
same adapter shape: build a `Ctx`, call a service. If an adapter grows logic,
push it down into the service.

## One home per concept (the anti-redundancy rule)

A fact is defined once and imported everywhere else - never copied, never
restated. **Derive instead of duplicating.**

| Concept                                   | Its one home                                                       |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Domain logic + authorization              | `$lib/server/<feature>/service.ts`                                 |
| Input validation                          | derived from the Drizzle table (`drizzle-zod`), beside the service |
| Permission vocabulary (statements, roles) | `$lib/permissions.ts`                                              |
| Plan tiers + limits                       | `$lib/plans.ts`                                                    |
| Public identity (name, URL, OG)           | `$lib/site.ts`                                                     |
| Error codes → HTTP status                 | `$lib/server/errors.ts`                                            |
| User-facing copy                          | Paraglide messages (`messages/*.json`)                             |
| DB schema (source of types + migrations)  | `$lib/server/db/schema.ts`                                         |
| Bindings + non-secret config              | `wrangler.jsonc` (typed in `src/app.d.ts`)                         |

Deriving, not duplicating, in practice: validation schemas come from the table,
plan feature bullets come from the plan's limits, canonical URLs come from
`site.ts`. If you write the same value or rule in two places, one of them is a
bug waiting to happen - collapse it to one.

## Where new code goes

| You're adding                                                               | Put it in                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Server-only logic for a feature                                             | `$lib/server/<feature>/` - a plural dir with `service.ts` (+ validation, `*.spec.ts`) |
| Data/vocabulary shared by client and server (no secrets, no server imports) | `$lib/` (like `plans.ts`, `permissions.ts`)                                           |
| Server config that reads `env`                                              | `$lib/server/<feature>/` (like `billing/plans.ts`)                                    |
| A pure, framework-free helper for client and server                         | `$lib/utils/`                                                                         |
| UI used by more than one route                                              | `$lib/components/<area>/`                                                             |
| UI used by exactly one route                                                | next to that route                                                                    |

## Stay clean

- **Reuse before you write.** Find an existing service, helper, or component and
  extend it; don't fork a parallel path. Services may call other services
  (todos calls `requireWithinLimit`) rather than copy their logic.
- **Delete, don't accumulate.** The `todos` feature and `$lib/vitest-examples`
  are references to delete, not foundations to copy. Remove dead code instead of
  leaving it unused. No barrel files.
- **Match the surroundings** in naming and idiom.
- **Write almost no comments.** The default is zero. Rename the thing, split the
  function, or write the doc instead - explanation belongs in `docs/`. A comment
  is allowed only for a load-bearing constraint the code cannot state itself (a
  runtime behaviour you are working around, a legal/protocol requirement), and
  then it is **one line**. Never narrate what the next line does, never restate a
  name, never explain a tradeoff inline, never add a file header or a JSDoc block
  to describe an obvious signature. Multi-line comment blocks are a defect: if
  something needs a paragraph, it needs a doc page. An empty `catch {}` needs no
  comment - `no-empty` already allows it. `check:invariants` fails a source file
  with a doc comment, a multi-line comment, or more than 2 comments (tool
  directives such as `eslint-disable` or `svelte-ignore` don't count). CI and
  workflow config (`.github/`) carries none at all; its reasoning lives in
  docs/deploy.md.
- **Files stay under 400 lines**, tests included (`check:invariants` enforces
  it). Split by responsibility: sibling modules, subcomponents, one spec per
  module.
- **Small and composable.** One well-named function that does one thing beats a
  branchy monolith.

# Invariants

- Routes are adapters. Logic lives in `$lib/server/<feature>/service.ts`.
- Services take a `Ctx` and, when acting for a user, an `Actor` (see
  `$lib/server/ctx.ts`) - authorization lives in the service, never in the route.
- Validation schemas live with their service, derived from the Drizzle table
  (`drizzle-zod`) so they can't drift from the database.
- Services signal failures by throwing `AppError` (`$lib/server/errors.ts`);
  route adapters convert with `httpError(e)`. Anything else surfaces as a 500
  with code `internal` via `handleError` - never leak internals to clients.
- Auth endpoints are rate limited by better-auth (Postgres-backed - tune via
  `rateLimit.customRules`). For app endpoints use the `RATE_LIMITER` binding
  seam and `AppError('rate_limited', ...)`.
- Org authorization: statements and roles live in `$lib/permissions.ts`;
  services load membership from the database (`requireMember` /
  `requirePermission` in `$lib/server/orgs/service.ts`) and check
  `can(role, ...)`. Never trust a role sent by the client.
- The tenant is the organization. User-scoped resources scope by `actor.id`
  (owning the row is the permission - see `todos/`); org-scoped resources scope
  by `organization_id` AND call `requirePermission(...)` for writes /
  `requireMember(...)` for reads (see `notes/`). `activeOrganizationId` on the
  session is an untrusted hint - services re-verify from the database.
  [multi-tenancy.md](docs/multi-tenancy.md).
- App-layer `where organization_id = …` scoping is the primary isolation
  mechanism. A table may additionally opt into RLS as a backstop: enable a
  `pgPolicy` on it (`schema.ts`, keyed on `current_setting('app.current_org_id',
true)` - currently only `note`) and route every query through `withTenant`
  (`$lib/server/tenant.ts`), which sets the context transaction-locally (never a
  session `SET` - pooled connections would leak it). Table **owners** bypass a
  plain `ENABLE`, so `note` is also `FORCE`d (migration `0008`); superusers bypass
  RLS even with `FORCE`, so production must connect as a **non-superuser** role
  (owner is fine once `FORCE`d). Local/dev runs as `postgres` (superuser), so RLS
  is inert there - the app layer covers it. Keep the app-layer `where` regardless.
- User-facing strings go through Paraglide (`messages/{locale}.json` →
  `m.*()` from `$lib/paraglide/messages`); don't hardcode UI text. English is
  the only locale - the plumbing stays so adding one is config, not a refactor.
  Legal pages are the deliberate exception: a policy for another jurisdiction
  is a different document, not a translation.
- Never tell a caller whether an email address has an account. Magic-link and
  password-reset responses are unconditional by design; branching on the result
  turns the form into an account-enumeration oracle.
- Endpoints that email an address the _caller_ chose are rate limited in
  `rateLimit.customRules` (`$lib/server/auth.ts`). The default limit is a spam
  cannon pointed at strangers.
- Captcha (Turnstile) is opt-in: set **both** `TURNSTILE_SITE_KEY` (public var) and
  `TURNSTILE_SECRET_KEY` (secret), or neither. Only the secret enables server-side
  enforcement; only the site key renders the widget - set the secret alone and
  sign-up / sign-in / password-reset demand a token the client never sends; set
  the site key alone and the widget renders but nothing is enforced. Breached-password
  rejection (`haveIBeenPwned`) is always on and **fails closed**. See docs/auth.md.
- The email body carries magic-link and reset tokens - bearer credentials.
  Never log it. `EMAIL_DEBUG` does, and lives only in `.dev.vars`, which is
  never deployed.
- Identity comes from `locals.user` (set in `hooks.server.ts`); protected pages
  go under `src/routes/app/`, whose layout redirects anonymous visitors. Auth
  screens live in `src/routes/(auth)/` (a group - the URLs stay `/login`,
  `/signup`, `/forgot-password`, `/reset-password`).
- Public pages live in `src/routes/(marketing)/` and are prerendered: they are
  served from the ASSETS binding without invoking the Worker, so they cost no
  session lookup. That means they cannot read the session - never put
  signed-in state in the marketing nav. Adding a public page means adding it to
  `src/routes/sitemap.xml/+server.ts`.
- Plan tiers and their limits live in `$lib/plans.ts` (shared, no secrets - the
  Creem product id per plan resolves server-side in
  `$lib/server/billing/plans.ts`). Metered quotas are enforced in the service
  with `requireWithinLimit`, which throws `limit_reached` (402) - never gate a
  quota in a route or trust a plan sent by the client. See docs/plans.md.
- Blog posts are trusted Markdown in `src/content/blog/*.md`, prerendered via
  `marked`. The post body is the one sanctioned `{@html}` (the content is
  author-authored) - if posts ever take untrusted input, sanitize first
  (docs/blog.md).
- Every page renders `$lib/components/seo/Seo.svelte`. Anything behind the auth
  boundary passes `noindex`. Public names and URLs come from `$lib/site.ts`;
  the canonical origin cannot be read from the request, because prerendering
  has no real one.
- Security headers are set twice on purpose: `hooks.server.ts` covers Worker
  responses, `_headers` (app root, copied into the build by the adapter)
  covers static assets (which never reach hooks). Change one, change the other.
- Never `fetch()` your own `+server.ts` from a `load`. Import the service.
- Never `s-maxage` on an authenticated page.
- `Promise.all` on independent queries. Awaiting I/O costs 0 CPU-ms.
- Layout `load`s fetch everything in one parallel round (trust optimistic
  context like the session's active org - services re-verify) and must not
  track `url` (`untrack` it), or every navigation re-runs their queries.
  Crossing the auth boundary needs `goto(..., { invalidateAll: true })`.
- `ctx.db` is always fresh (caching-disabled Hyperdrive). `ctx.dbCached` may
  be up to ~60s stale and is never invalidated by writes - hot,
  staleness-tolerant reads only. Auth and read-after-write always use `ctx.db`.
- Log structured objects (`console.log({ ... })`) - Workers Logs indexes
  JSON fields; string concatenation buries them.
- Post-response work goes through `ctx.waitUntil`, never awaited inline.
- Non-HTTP events (cron, queues) enter through `src/worker.ts`, the custom
  Workers entry. Its handlers are adapters like routes: `createWorkerCtx`,
  then call a service.
- Workflow classes live in `$lib/server/workflows/` and are re-exported from
  `src/worker.ts`. Steps orchestrate only - build a fresh `Ctx` per step, call
  a service - and every step must be idempotent (it may run more than once).
- Durable Objects are allowed and previewable (Worker Previews). Caveat: a version
  that adds or changes a DO class ships via `wrangler deploy`, not `deploy:canary`,
  and cannot be rolled back across - so keep DO migrations small and standalone, or
  isolate a stateful DO in a sidecar Worker (docs/realtime.md). Default stays
  stateless + Postgres.
- No localStorage. No barrel files.
- Prefer `$derived`/`$derived.by` and event handlers over `$effect`. Reach for
  `$effect` only for genuine side effects reactive values can't express (DOM
  measurement, imperative focus, subscribing to a non-reactive external source) -
  never to compute state from state, which desyncs and double-runs. See docs/ui.md.
- Brand color has one home: the `primary-*` scale in `src/app.css` `@theme`.
  Components use `*-primary-*` utilities for fills and borders, never a raw
  palette like `blue-600`; brand-colored text is `text-link`. Neutrals come only
  from the semantic tokens (`bg-background`, `text-foreground`, `bg-muted`,
  `text-muted-foreground`, `border-border`, ...) and status colors from
  `destructive`/`success`/`warning`. Never `gray-*`, `red-*`, `text-primary-*` or
  `bg-white`: the `.dark` theme swaps only the tokens (`check:invariants`
  enforces this). Utility-first Tailwind; global CSS only in `app.css`. See
  docs/ui.md.
- A `load` returns only devalue-serializable data.
- Production is trunk-based continuous deploy (merge to `main` → deploy). Release
  safety is feature flags (`$lib/flags.ts`, docs/flags.md) + versioned rollback
  (`bun run deploy:rollback`), not release branches; migrations are expand/contract.
  See docs/deploy.md and docs/flags.md.
- Secrets come from `.dev.vars` locally and `wrangler secret put` in
  production - never hardcoded, never committed.
- Money and precise quantities use `decimalNumeric`
  (`$lib/server/db/types.ts`) - Postgres numeric ↔ decimal.js, never floats.
- Email goes through `$lib/server/email/service.ts` (logs when the
  `send_email` binding is absent). Content is templated in
  `$lib/server/email/templates/` with `email_*` Paraglide strings, rendered in
  the recipient's `user.locale` via `m.*({}, { locale })` - never inline strings
  (see docs/auth.md). File bytes move via presigned URLs
  (`$lib/server/storage`) with actor-scoped keys - never proxy uploads
  through the Worker.
- Any new actor-scoped R2 key prefix must be erased in `eraseUserData`
  (`$lib/server/account/service.ts`) on account deletion - otherwise deleting a
  user cascades their DB rows but silently orphans their files, breaking
  right-to-erasure. The erasure tombstone and backup restore-replay are in
  docs/backups.md.

# Naming

- Branches: `<type>/<kebab-summary>`, e.g. `feat/note-sharing`.
- Commits and PR titles: Conventional Commits - `type(scope): imperative
summary`, lowercase, ≤72 chars. Types: feat, fix, docs, refactor, perf,
  test, build, ci, chore, revert. CI rejects violations on PRs.
- Files: kebab-case `.ts` (`auth-client.ts`); components PascalCase
  `.svelte`. Features are plural directories (`todos/`) with `service.ts`.
- Database: singular snake_case tables and columns; camelCase TS properties.
- Paraglide keys and `AppError` codes: snake_case. Log event names:
  dot-namespaced (`cron.purge`, `email.skipped`).

# Git & PRs

- Commit and push only when the user asks. Don't create commits as a side effect
  of finishing a change unless requested.
- Work on a branch off `main` (`<type>/<kebab-summary>`, see Naming) - never
  commit directly to `main`. Land work through a **pull request**, which is how
  CI gates it before it reaches `main`.
- Keep commits small and each one a passing state. An enforced pre-commit hook
  (`.githooks/pre-commit`, wired via `core.hooksPath` on `bun install` in `app/`) runs
  `bun run check:invariants`, `bun run check:secrets`, `bun run lint`, `bun run check`, and
  `bun run test` before every commit; `--no-verify` only a genuine WIP. Titles are
  Conventional Commits (see Naming); the body says what
  changed and why.
- Open the PR with `gh`, a Conventional-Commit title (it becomes the squashed
  commit subject), and a body. CI runs `conventions` + `test` + `portability` +
  `audit` (aggregated as the required `ci` check);
  don't merge until they're green, and use the PR **preview URL** to verify the
  change in the real runtime.
- Merge is **squash-only** with the PR title as the subject (set by
  `.github/repo-setup.sh`). Delete the branch after.
- The `main` ruleset requires PRs with green checks; repo **admins bypass** it,
  so a solo maintainer _may_ push straight to `main` when they explicitly choose
  to. That's the exception, not the default - prefer the PR + preview flow.
- Never commit secrets or `.dev.vars*`; never force-push `main`; the lockfile is
  committed and CI installs `--frozen-lockfile`.

# Workflow

- Server code is tested inside workerd (`workers` Vitest project) against real
  Postgres - tables are truncated before each test, so assert on counts. The
  truncate list in `tests/isolate-db.ts` is hand-maintained: add every new
  table to it. A table that is missing leaks rows between tests and between
  runs, and a table with no foreign key is not reached by `CASCADE`.
  Components run in the browser (`browser` project). `bun run test` runs both;
  `bun run test:e2e` covers HTTP-level behavior (hooks, routing, auth).
- After changing `wrangler.jsonc`: `bun run cf-typegen`. After changing
  `$lib/server/db/schema.ts`: `bun run db:generate` + `bun run db:migrate`. After
  changing `messages/*.json`: `bun run i18n:compile` (check/prepare run it too).
- Migrations in `drizzle/` are generated and committed - never edit them by hand,
  with one exception: an index on a table that is already large, which must be
  `IF NOT EXISTS` so a manual `CONCURRENTLY` build can precede it (docs/database.md).
- `src/worker-configuration.d.ts` is generated - never edit it.
- `bun run check:invariants` enforces the greppable rules above (a new table must be
  in `isolate-db`, no `{@html}` outside its allowlist, no `s-maxage` on an authed
  route, no barrel files, no fetching your own API from a `load`, no em/en dashes,
  no raw `blue-` or neutral palette in components, files under 400 lines, the
  comment limits, no comments in `.github/`, `bun.lock` kept at
  `lockfileVersion` 1 so Dependabot can read it); extend
  `scripts/check-invariants.mjs` when you add one worth guarding.
  `bun run check:secrets` blocks committed credentials. Both run in the pre-commit
  hook and CI. They catch mechanical slips only - logic and reasoning bugs still
  need tests and review (`/code-review` on the diff before merging).
- Guided workflows live in `.agents/skills/`: `setup`, `add-feature`,
  `add-plan`, `upgrade-template`. Read the matching `SKILL.md` before doing that
  kind of work.
- Done means `bun run lint`, `bun run check`, `bun run check:invariants`,
  `bun run check:secrets`, and `bun run test` all pass.
