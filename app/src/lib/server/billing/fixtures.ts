import { env } from 'cloudflare:workers';
import { createWorkerCtx } from '../ctx';
import { member, organization, user } from '../db/schema';

export const ctx = createWorkerCtx(env);

export const orgId = 'org-1';

export async function seedBillingOrg() {
	const rows = await ctx.db
		.insert(user)
		.values(
			['owner', 'member'].map((name) => ({
				id: crypto.randomUUID(),
				name,
				email: `${name}@example.com`
			}))
		)
		.returning();
	const [owner, plain] = rows.map((r) => r.id) as [string, string];
	await ctx.db.insert(organization).values({ id: orgId, name: 'Acme', slug: 'acme' });
	await ctx.db.insert(member).values([
		{ id: crypto.randomUUID(), organizationId: orgId, userId: owner, role: 'owner' },
		{ id: crypto.randomUUID(), organizationId: orgId, userId: plain, role: 'member' }
	]);
	return { owner, plain };
}
