import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { user } from '../db/schema';
import { createWorkerCtx, type Actor } from '../ctx';
import { addTodo, listTodos, setTodoDone } from './service';

const ctx = createWorkerCtx(env);
const orgId = 'org-todos';
let actor: Actor;
let other: Actor;

beforeEach(async () => {
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
	it('adds and lists todos', async () => {
		const created = await addTodo(ctx, env, actor, orgId, { title: 'Ship the template' });
		expect(created.done).toBe(false);

		const todos = await listTodos(ctx, actor);
		expect(todos).toHaveLength(1);
		expect(todos[0]?.title).toBe('Ship the template');
	});

	it('scopes todos to their owner', async () => {
		await addTodo(ctx, env, actor, orgId, { title: 'Mine' });
		expect(await listTodos(ctx, other)).toHaveLength(0);
	});

	it('toggles completion only for the owner', async () => {
		const created = await addTodo(ctx, env, actor, orgId, { title: 'Toggle me' });
		await expect(setTodoDone(ctx, other, created.id, true)).rejects.toMatchObject({
			code: 'not_found'
		});

		const updated = await setTodoDone(ctx, actor, created.id, true);
		expect(updated.done).toBe(true);
	});
});
