import { and, desc, eq } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { note } from '../db/schema';
import { AppError } from '../errors';
import { notifyOrg } from '../notifications/service';
import { requireMember, requirePermission } from '../orgs/service';
import { withTenant } from '../tenant';
import type { Actor, Ctx } from '../ctx';

export const noteInsertSchema = createInsertSchema(note, {
	title: (s) => s.trim().min(1).max(200),
	body: (s) => s.trim().max(10_000).optional()
}).pick({ title: true, body: true });

export type NoteInsert = z.infer<typeof noteInsertSchema>;

export const noteUpdateSchema = noteInsertSchema.partial();
export type NoteUpdate = z.infer<typeof noteUpdateSchema>;

export async function listNotes(ctx: Ctx, actor: Actor, orgId: string) {
	await requireMember(ctx, actor, orgId);
	return withTenant(ctx, orgId, (tx) =>
		tx.select().from(note).where(eq(note.organizationId, orgId)).orderBy(desc(note.id))
	);
}

export async function createNote(ctx: Ctx, actor: Actor, orgId: string, input: NoteInsert) {
	await requirePermission(ctx, actor, orgId, { note: ['create'] });
	const created = await withTenant(ctx, orgId, async (tx) => {
		const [row] = await tx
			.insert(note)
			.values({ ...input, organizationId: orgId, createdBy: actor.id })
			.returning();
		if (!row) throw new AppError('internal', 'insert returned no row');
		return row;
	});
	ctx.waitUntil(
		Promise.all([
			notifyOrg(ctx, orgId, {
				bodyKey: 'notif_note_created',
				params: { title: created.title },
				href: '/app/notes',
				except: actor.id
			}),
			notifyOrg(ctx, orgId, {
				kind: 'refresh',
				params: { invalidate: 'app:notes' },
				except: actor.id
			})
		])
	);
	return created;
}

export async function updateNote(
	ctx: Ctx,
	actor: Actor,
	orgId: string,
	id: number,
	patch: NoteUpdate
) {
	await requirePermission(ctx, actor, orgId, { note: ['update'] });

	const fields: Partial<Pick<typeof note.$inferInsert, 'title' | 'body'>> = {};
	if (patch.title !== undefined) fields.title = patch.title;
	if (patch.body !== undefined) fields.body = patch.body;
	if (Object.keys(fields).length === 0) throw new AppError('invalid', 'Nothing to update');

	return withTenant(ctx, orgId, async (tx) => {
		const [updated] = await tx
			.update(note)
			.set(fields)
			.where(and(eq(note.id, id), eq(note.organizationId, orgId)))
			.returning();
		if (!updated) throw new AppError('not_found', 'Note not found');
		return updated;
	});
}

export async function deleteNote(ctx: Ctx, actor: Actor, orgId: string, id: number) {
	await requirePermission(ctx, actor, orgId, { note: ['delete'] });
	return withTenant(ctx, orgId, async (tx) => {
		const [deleted] = await tx
			.delete(note)
			.where(and(eq(note.id, id), eq(note.organizationId, orgId)))
			.returning();
		if (!deleted) throw new AppError('not_found', 'Note not found');
		return deleted;
	});
}
