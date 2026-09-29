# Adding a feature

The end-to-end recipe: database model → service → route → UI → tests. The shipped `todos` feature is the worked example - every snippet below is taken from it (lightly trimmed), so you can diff your feature against a known-good one. (Delete `todos` with its tests once you have your own.)

The architecture in one line: **routes are adapters; logic lives in `$lib/server/<feature>/service.ts`; services take a `Ctx` and an `Actor`, and authorization happens inside them.**

> **Using an AI coding agent?** The **`add-feature`** skill (**`/add-feature`**) drives this recipe
> (and the durable-execution + SSE variant for long-running work). **`add-plan`** (**`/add-plan`**) covers billing.

## 1. Model - `src/lib/server/db/schema.ts`

Add a table. Singular snake_case names in SQL, camelCase properties in TS. Spread the shared `timestamps` helper, and scope rows to their owner with a foreign key:

```ts
export const todo = pgTable('todo', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	title: text('title').notNull(),
	done: boolean('done').notNull().default(false),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	...timestamps
});

export type Todo = typeof todo.$inferSelect;
```

Org-scoped instead of user-scoped? Reference `organization.id` instead of `user.id` - see step 6.

Money or precise quantities: use `decimalNumeric` from `$lib/server/db/types.ts`, never floats ([database.md](database.md#money-and-precision)).

Then, always this trio:

```sh
bun run db:generate   # writes a migration into drizzle/ - committed, never hand-edited
bun run db:migrate    # applies it locally
```

…and add the table to the truncate list in **`tests/isolate-db.ts`**. This is hand-maintained; a missing table leaks rows between tests, and a table with no foreign key is not reached by `CASCADE`.

## 2. Service - `src/lib/server/todos/service.ts`

Features are plural directories with a `service.ts`. The service owns validation (derived from the table, so it can't drift) and authorization (actor scoping):

```ts
import { and, count, desc, eq } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { requireWithinLimit } from '../billing/entitlement';
import { todo } from '../db/schema';
import { AppError } from '../errors';
import type { Actor, Ctx } from '../ctx';

export const todoInsertSchema = createInsertSchema(todo, {
	title: (s) => s.trim().min(1).max(200)
}).pick({ title: true });

export type TodoInsert = z.infer<typeof todoInsertSchema>;

export function listTodos(ctx: Ctx, actor: Actor) {
	return ctx.db.select().from(todo).where(eq(todo.userId, actor.id)).orderBy(desc(todo.id));
}

export async function addTodo(ctx: Ctx, env: Env, actor: Actor, orgId: string, input: TodoInsert) {
	const [row] = await ctx.db.select({ value: count() }).from(todo).where(eq(todo.userId, actor.id));
	await requireWithinLimit(ctx, env, orgId, 'maxTodos', row?.value ?? 0);

	const [created] = await ctx.db
		.insert(todo)
		.values({ ...input, userId: actor.id })
		.returning();
	if (!created) throw new AppError('internal', 'insert returned no row');
	return created;
}

export async function setTodoDone(ctx: Ctx, actor: Actor, id: number, done: boolean) {
	const [updated] = await ctx.db
		.update(todo)
		.set({ done })
		.where(and(eq(todo.id, id), eq(todo.userId, actor.id)))
		.returning();
	if (!updated) throw new AppError('not_found', 'Todo not found');
	return updated;
}
```

Rules the service must follow:

- Failures are `AppError(code, message)` - never `error()` from SvelteKit, never raw throws for expected failures ([architecture.md](architecture.md#errors)).
- Metering a resource by plan? Call `requireWithinLimit(ctx, env, orgId, key, currentCount)` before the write - it throws `limit_reached` (402) at the cap. `addTodo` shows the pattern; limits live in `$lib/plans.ts` ([plans.md](plans.md)).
- Independent queries go through `Promise.all` - awaiting I/O costs 0 CPU-ms.
- Fresh reads use `ctx.db`; only hot, staleness-tolerant reads may use `ctx.dbCached` ([database.md](database.md#query-caching---read-before-creating-the-hyperdrive-config)).
- Post-response work (notifications, cleanup) goes through `ctx.waitUntil`, never awaited inline.

## 3. Route adapter - `src/routes/app/<feature>/+page.server.ts`

The route's whole job: resolve identity, build a `Ctx`, call the service, convert errors. Under `src/routes/app/` the layout already redirects anonymous visitors:

```ts
export const load: PageServerLoad = async ({ platform, parent }) => {
	const { user } = await parent();
	const ctx = createCtx(platform);
	const [todos, form] = await Promise.all([
		listTodos(ctx, { id: user.id }),
		superValidate(zod4(todoInsertSchema))
	]);
	return { todos, form };
};

export const actions: Actions = {
	add: async ({ request, platform, locals }) => {
		const user = locals.user;
		if (!user) redirect(302, '/login');
		const orgId = locals.session?.activeOrganizationId;
		if (!orgId) error(404, { message: 'No active organization', code: 'not_found' });

		const form = await superValidate(request, zod4(todoInsertSchema));
		if (!form.valid) return fail(400, { form });
		try {
			await addTodo(createCtx(platform), platform!.env, { id: user.id }, orgId, form.data);
		} catch (e) {
			httpError(e);
		}
		return message(form, m.todo_added()); // strings go through Paraglide, never inline
	},

	toggle: async ({ request, platform, locals }) => {
		const user = locals.user;
		if (!user) redirect(302, '/login');

		const data = await request.formData();
		try {
			await setTodoDone(
				createCtx(platform),
				{ id: user.id },
				Number(data.get('id')),
				data.get('done') === 'true'
			);
		} catch (e) {
			httpError(e);
		}
	}
};
```

Adapter rules:

- Never `fetch()` your own `+server.ts` from a `load` - import the service.
- A `load` returns only devalue-serializable data.
- Layout loads fetch everything in one parallel round and must not track `url` (`untrack` it), or every navigation re-runs their queries.
- Building a JSON API instead? Same pattern in a `+server.ts`: `try { … } catch (e) { httpError(e); }`.

## 4. UI - `+page.svelte`

Forms go through sveltekit-superforms (the `form` returned by `load`). User-facing strings go through Paraglide - add keys to `messages/en.json`, run `bun run i18n:compile`, render `{m.your_key()}` ([i18n.md](i18n.md)). A component used by one route lives next to that route; shared components go in `$lib/components/`.

## 5. Tests

Two files next to the service (patterns in [testing.md](testing.md)):

- `service.spec.ts` - runs **inside workerd** against real Postgres. Seed the users/orgs your foreign keys need in `beforeEach`, then assert behavior _and_ authorization (the "other actor sees nothing" test is the one that matters).
- `validation.spec.ts` - fast-check property tests over the zod schema: cheap, and they catch the edge cases you didn't think to enumerate.

If the feature has HTTP-level behavior worth guarding (redirects, headers), extend `e2e/smoke.spec.ts`.

## 6. Org-scoped features and permissions

If the resource belongs to an organization rather than a user:

1. Add the action vocabulary in `$lib/permissions.ts` - e.g. `report: ['create', 'delete']` in `statement`, then grant it per role. This file is shared by server and client, so UI and enforcement can't disagree.
2. In the service, load membership from the database and check it before touching data:

   ```ts
   await requirePermission(ctx, actor, orgId, { report: ['create'] });
   ```

   (`$lib/server/orgs/service.ts` - throws a `forbidden` `AppError` for non-members and under-privileged roles. Never trust a role sent by the client.)

3. In the UI, `authClient.organization.checkRolePermission(...)` may hide a button - it is never the real enforcement.

## 7. Done

```sh
bun run lint && bun run check && bun run test
```

The checklist form:

- [ ] Table in `schema.ts` (+ `bun run db:generate` + `bun run db:migrate`)
- [ ] Table added to `tests/isolate-db.ts`
- [ ] Service with schema-derived validation, `AppError` failures, actor/org scoping
- [ ] Route adapter (thin), page UI with superforms
- [ ] Strings in `messages/en.json` + `bun run i18n:compile`
- [ ] Permission vocabulary updated if org-scoped
- [ ] `service.spec.ts` (incl. the authorization case) + `validation.spec.ts`
- [ ] `bun run lint` + `bun run check` + `bun run check:invariants` + `bun run check:secrets` + `bun run test` green
