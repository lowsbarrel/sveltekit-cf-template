import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createWorkerCtx } from '../ctx';
import { session, user, verification } from '../db/schema';
import { purgeExpired } from './service';

const ctx = createWorkerCtx(env);

const HOUR = 3_600_000;

describe('purgeExpired', () => {
	it('deletes only expired sessions and verifications', async () => {
		const now = new Date();
		const past = new Date(now.getTime() - HOUR);
		const future = new Date(now.getTime() + HOUR);

		const [owner] = await ctx.db
			.insert(user)
			.values({ id: crypto.randomUUID(), name: 'Ada', email: 'ada@example.com' })
			.returning();
		await ctx.db.insert(session).values([
			{ id: crypto.randomUUID(), token: 'expired', userId: owner!.id, expiresAt: past },
			{ id: crypto.randomUUID(), token: 'valid', userId: owner!.id, expiresAt: future }
		]);
		await ctx.db.insert(verification).values([
			{ id: crypto.randomUUID(), identifier: 'a', value: 'v', expiresAt: past },
			{ id: crypto.randomUUID(), identifier: 'b', value: 'v', expiresAt: future }
		]);

		expect(await purgeExpired(ctx, now)).toEqual({ sessions: 1, verifications: 1 });
		expect(await ctx.db.select().from(session)).toHaveLength(1);
		expect(await ctx.db.select().from(verification)).toHaveLength(1);
	});

	it('is a no-op when nothing is expired', async () => {
		expect(await purgeExpired(ctx)).toEqual({ sessions: 0, verifications: 0 });
	});
});
