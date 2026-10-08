import { and, count, desc, eq, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { requireWithinLimit } from '../billing/entitlement';
import { todo } from '../db/schema';
import { AppError } from '../errors';
import { requireMember } from '../orgs/service';
import type { Actor, Ctx } from '../ctx';

export const todoInsertSchema = createInsertSchema(todo, {
	title: (s) => s.trim().min(1).max(200)
}).pick({ title: true });

export type TodoInsert = z.infer<typeof todoInsertSchema>;

export function listTodos(ctx: Ctx, actor: Actor) {
	return ctx.db.select().from(todo).where(eq(todo.userId, actor.id)).orderBy(desc(todo.id));
}

export async function addTodo(ctx: Ctx, env: Env, actor: Actor, orgId: string, input: TodoInsert) {
	await requireMember(ctx, actor, orgId);
	return ctx.db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${actor.id}))`);
		const [row] = await tx.select({ value: count() }).from(todo).where(eq(todo.userId, actor.id));
		await requireWithinLimit(
			{ ...ctx, db: tx as unknown as Ctx['db'] },
			env,
			orgId,
			'maxTodos',
			row?.value ?? 0
		);
		const [created] = await tx
			.insert(todo)
			.values({ ...input, userId: actor.id })
			.returning();
		if (!created) throw new AppError('internal', 'insert returned no row');
		return created;
	});
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
