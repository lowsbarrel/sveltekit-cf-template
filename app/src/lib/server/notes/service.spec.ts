import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { member, organization, user } from '../db/schema';
import { createWorkerCtx, type Actor } from '../ctx';
import { createNote, deleteNote, listNotes, updateNote } from './service';

const ctx = createWorkerCtx(env);

const orgA = 'org-a';
const orgB = 'org-b';
let ownerA: Actor;
let memberA: Actor;
let memberB: Actor;

beforeEach(async () => {
	const rows = await ctx.db
		.insert(user)
		.values([
			{ id: crypto.randomUUID(), name: 'Owner A', email: 'owner-a@example.com' },
			{ id: crypto.randomUUID(), name: 'Member A', email: 'member-a@example.com' },
			{ id: crypto.randomUUID(), name: 'Member B', email: 'member-b@example.com' }
		])
		.returning();
	ownerA = { id: rows[0]!.id };
	memberA = { id: rows[1]!.id };
	memberB = { id: rows[2]!.id };

	await ctx.db.insert(organization).values([
		{ id: orgA, name: 'Acme', slug: 'acme' },
		{ id: orgB, name: 'Globex', slug: 'globex' }
	]);
	await ctx.db.insert(member).values([
		{ id: crypto.randomUUID(), organizationId: orgA, userId: ownerA.id, role: 'owner' },
		{ id: crypto.randomUUID(), organizationId: orgA, userId: memberA.id, role: 'member' },
		{ id: crypto.randomUUID(), organizationId: orgB, userId: memberB.id, role: 'member' }
	]);
});

describe('notes service', () => {
	it('creates and lists notes for a member of the org', async () => {
		const created = await createNote(ctx, memberA, orgA, { title: 'Team note', body: 'Hello' });
		expect(created.organizationId).toBe(orgA);
		expect(created.createdBy).toBe(memberA.id);

		const notes = await listNotes(ctx, ownerA, orgA);
		expect(notes).toHaveLength(1);
		expect(notes[0]?.title).toBe('Team note');
	});
});

describe('cross-tenant isolation', () => {
	it('refuses to list another org’s notes for a non-member', async () => {
		await createNote(ctx, ownerA, orgA, { title: 'Secret' });

		await expect(listNotes(ctx, memberB, orgA)).rejects.toMatchObject({ code: 'forbidden' });
		expect(await listNotes(ctx, memberB, orgB)).toHaveLength(0);
	});

	it('cannot update or delete across the tenant boundary', async () => {
		const target = await createNote(ctx, ownerA, orgA, { title: 'Original' });

		await expect(
			updateNote(ctx, memberB, orgB, target.id, { title: 'Hacked' })
		).rejects.toMatchObject({ code: 'not_found' });

		await expect(
			updateNote(ctx, memberB, orgA, target.id, { title: 'Hacked' })
		).rejects.toMatchObject({ code: 'forbidden' });
		await expect(deleteNote(ctx, memberB, orgA, target.id)).rejects.toMatchObject({
			code: 'forbidden'
		});

		const notes = await listNotes(ctx, ownerA, orgA);
		expect(notes).toHaveLength(1);
		expect(notes[0]?.title).toBe('Original');
	});
});

describe('role checks within an org', () => {
	it('lets a plain member create and update but not delete', async () => {
		const created = await createNote(ctx, memberA, orgA, { title: 'Draft' });

		const updated = await updateNote(ctx, memberA, orgA, created.id, { title: 'Revised' });
		expect(updated.title).toBe('Revised');

		await expect(deleteNote(ctx, memberA, orgA, created.id)).rejects.toMatchObject({
			code: 'forbidden'
		});

		const deleted = await deleteNote(ctx, ownerA, orgA, created.id);
		expect(deleted.id).toBe(created.id);
		expect(await listNotes(ctx, ownerA, orgA)).toHaveLength(0);
	});
});
