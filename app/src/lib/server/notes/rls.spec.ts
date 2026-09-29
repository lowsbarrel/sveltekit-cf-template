import { env } from 'cloudflare:workers';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { note, organization } from '../db/schema';
import { createWorkerCtx } from '../ctx';

const ctx = createWorkerCtx(env);

const orgA = 'rls-org-a';
const orgB = 'rls-org-b';

beforeEach(async () => {
	await ctx.db.execute(sql`
		DO $$ BEGIN
			IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rls_test') THEN
				CREATE ROLE rls_test NOSUPERUSER;
			END IF;
		END $$;
	`);
	await ctx.db.execute(sql`GRANT USAGE ON SCHEMA public TO rls_test`);
	await ctx.db.execute(sql`GRANT SELECT, INSERT, UPDATE, DELETE ON "note" TO rls_test`);

	await ctx.db.insert(organization).values([
		{ id: orgA, name: 'Acme', slug: 'rls-acme' },
		{ id: orgB, name: 'Globex', slug: 'rls-globex' }
	]);
	await ctx.db.insert(note).values([
		{ organizationId: orgA, title: 'A note' },
		{ organizationId: orgB, title: 'B note' }
	]);
});

function titlesAsRestrictedRole(orgId: string | null): Promise<string[]> {
	return ctx.db.transaction(async (tx) => {
		if (orgId !== null) {
			await tx.execute(sql`select set_config('app.current_org_id', ${orgId}, true)`);
		}
		await tx.execute(sql`SET LOCAL ROLE rls_test`);
		const rows = await tx.select({ title: note.title }).from(note);
		return rows.map((r) => r.title);
	});
}

describe('note RLS policy (non-superuser role)', () => {
	it('shows only the tenant named in app.current_org_id', async () => {
		expect(await titlesAsRestrictedRole(orgA)).toEqual(['A note']);
		expect(await titlesAsRestrictedRole(orgB)).toEqual(['B note']);
	});

	it('shows nothing when no tenant context is set', async () => {
		expect(await titlesAsRestrictedRole(null)).toEqual([]);
	});

	it('blocks a write that would escape the tenant (WITH CHECK)', async () => {
		await expect(
			ctx.db.transaction(async (tx) => {
				await tx.execute(sql`select set_config('app.current_org_id', ${orgA}, true)`);
				await tx.execute(sql`SET LOCAL ROLE rls_test`);
				await tx.insert(note).values({ organizationId: orgB, title: 'smuggled' });
			})
		).rejects.toThrow();
	});
});

describe('note RLS policy (superuser caveat)', () => {
	it('is bypassed for the superuser connection the app uses locally', async () => {
		const rows = await ctx.db.select({ title: note.title }).from(note);
		expect(rows.map((r) => r.title).sort()).toEqual(['A note', 'B note']);
	});
});
