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
