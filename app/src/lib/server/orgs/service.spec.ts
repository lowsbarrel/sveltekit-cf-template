import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { can } from '$lib/permissions';
import { createWorkerCtx } from '../ctx';
import { member, organization, invitation, user } from '../db/schema';
import { renameOrganization, requireMember, listTeam } from './service';

const ctx = createWorkerCtx(env);

let owner: string;
let admin: string;
let plain: string;
let outsider: string;
const orgId = 'org-1';

beforeEach(async () => {
	const rows = await ctx.db
		.insert(user)
		.values(
			['owner', 'admin', 'member', 'outsider'].map((name) => ({
				id: crypto.randomUUID(),
				name,
				email: `${name}@example.com`
			}))
		)
		.returning();
	[owner, admin, plain, outsider] = rows.map((r) => r.id) as [string, string, string, string];
	await ctx.db.insert(organization).values({ id: orgId, name: 'Acme', slug: 'acme' });
	await ctx.db.insert(member).values([
		{ id: crypto.randomUUID(), organizationId: orgId, userId: owner, role: 'owner' },
		{ id: crypto.randomUUID(), organizationId: orgId, userId: admin, role: 'admin' },
		{ id: crypto.randomUUID(), organizationId: orgId, userId: plain, role: 'member' }
	]);
});

describe('permissions', () => {
	it('grants by role and denies unknown roles', () => {
		expect(can('owner', { organization: ['delete'] })).toBe(true);
		expect(can('admin', { organization: ['update'] })).toBe(true);
		expect(can('member', { organization: ['update'] })).toBe(false);
		expect(can('member', { todo: ['create'] })).toBe(true);
		expect(can('member', { todo: ['delete'] })).toBe(false);
		expect(can('made-up-role', { todo: ['create'] })).toBe(false);
	});
});

describe('orgs service', () => {
	it('rejects non-members outright', async () => {
		await expect(requireMember(ctx, { id: outsider }, orgId)).rejects.toMatchObject({
			code: 'forbidden'
		});
	});

	it('lets admins rename, but not members', async () => {
		const renamed = await renameOrganization(ctx, { id: admin }, orgId, 'Acme Corp');
		expect(renamed.name).toBe('Acme Corp');

		await expect(renameOrganization(ctx, { id: plain }, orgId, 'Nope')).rejects.toMatchObject({
			code: 'forbidden'
		});
	});

	it('lists only unexpired pending invitations', async () => {
		await ctx.db.insert(invitation).values([
			{
				id: 'inv-live',
				organizationId: orgId,
				email: 'live@example.com',
				role: 'member',
				status: 'pending',
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
				inviterId: owner
			},
			{
				id: 'inv-dead',
				organizationId: orgId,
				email: 'dead@example.com',
				role: 'member',
				status: 'pending',
				expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
				inviterId: owner
			}
		]);

		const { invites } = await listTeam(ctx, { id: owner }, orgId);
		expect(invites.map((i) => i.id)).toEqual(['inv-live']);
	});
});
