# Testing

Three test layers, each honest about what it covers, plus a post-deploy smoke check that is not part of the merge gate. `bun run test` runs the first two; `bun run test:e2e` the third. Done means `bun run lint`, `bun run check`, `bun run check:invariants`, `bun run check:secrets` and `bun run test` all pass - the same set `.githooks/pre-commit` runs.

## The layers

- **`workers` project** (`vitest.workers.config.ts`) - services and route handlers run **inside workerd** against real Postgres, imported directly: no HTTP, no hooks, no routing. The pool reads `wrangler.jsonc`, so tests see the real bindings (Hyperdrive → the compose database) and `.dev.vars`. Tables are truncated before each test (`tests/isolate-db.ts`) and files run serially, so `toHaveLength(n)` is a valid assertion. If the suite outgrows serial execution, switch to one Postgres schema per worker.
- **`browser` project** (`vitest.browser.config.ts`) - components in headless Chromium (`bunx playwright install chromium` once). `src/lib/vitest-examples/` holds a deletable reference test of each kind.
- **E2E** (`e2e/`) - the only layer that exercises HTTP end-to-end (hooks, auth, routing): Playwright drives the production build on `wrangler dev`, including the full signup → todo → signout flow. The Playwright config seeds `.dev.vars`, migrates, builds and boots the server itself.
- **Post-deploy smoke** (`smoke/`, `playwright.smoke.config.ts`) - a Playwright `smoke` project that runs a handful of read-only checks against the **live deployed URL** (resolved from `TEST_PAGE_URL`): `/api/health` returns `ok` (proves the Worker booted, not just static ASSETS), the home page and a marketing route (`/pricing`) return 200 with an `h1`, and `/login` renders its form. Safe for production - zero mutations, no signup, no POST, no DB. It has no `webServer`, so it never boots a local server. It is **not** part of the merge gate; it runs after `deploy` on `main` (see [deploy.md](deploy.md)).

## Rules that keep tests trustworthy

- **Every new table goes into `tests/isolate-db.ts`.** The truncate list is hand-maintained. A missing table leaks rows between tests and between runs; a table with no foreign key is not reached by `CASCADE`.
- Property-based tests use [fast-check](https://fast-check.dev/) - see `src/lib/server/todos/validation.spec.ts` for the pattern (validation schemas are cheap, high-value targets).
- Server tests import the service directly and build a plain `Ctx` - no HTTP scaffolding. If a test needs an HTTP behavior (redirects, headers, cookies), it belongs in E2E.
- Auth flows that send email need `EMAIL_DEBUG=true` in `.dev.vars` (the default from `.dev.vars.example`) so the test can fish the link out of the logged body.
- **Keep specs hermetic to `wrangler.jsonc`.** One config feeds local, prod, and tests, so a "prod-only" binding you uncomment (e.g. `send_email`) otherwise leaks into the test env and breaks assertions about the unbound path. Force the binding off in the spec - `createAuth({ ...env, EMAIL: undefined, EMAIL_DEBUG: 'true' }, …)` in `auth.spec.ts` is the pattern - and stub any binding your assertions depend on the same way.

## Writing a service test

The shape used throughout (see `src/lib/server/todos/service.spec.ts`):

```ts
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { user } from '../db/schema';
import { createWorkerCtx, type Actor } from '../ctx';
import { addTodo, listTodos } from './service';

const ctx = createWorkerCtx(env);
// No subscription for this org → the free plan applies (addTodo checks the quota).
const orgId = 'org-todos';
let actor: Actor;
let other: Actor;

beforeEach(async () => {
	// Foreign keys are real: create the users the todos will belong to.
	const rows = await ctx.db
		.insert(user)
		.values([
			{ id: crypto.randomUUID(), name: 'Ada', email: 'ada@example.com' },
			{ id: crypto.randomUUID(), name: 'Grace', email: 'grace@example.com' }
		])
		.returning();
	actor = { id: rows[0]!.id };
	other = { id: rows[1]!.id };
});

describe('todos service', () => {
	it('scopes todos to their owner', async () => {
		await addTodo(ctx, env, actor, orgId, { title: 'Mine' });
		expect(await listTodos(ctx, other)).toHaveLength(0);
	});
});
```

## CI

The `test` job runs the same commands against a Postgres service container, plus a build and a bundle-size guardrail; the `portability` job builds with `adapter-node` and smoke-tests it on plain Node, failing the moment a Cloudflare binding leaks into portable code. See [deploy.md](deploy.md) for the full pipeline.
