import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '$lib/utils/hash';
import { newsletterSubscriber } from '../db/schema';
import { createWorkerCtx } from '../ctx';
import { confirm, subscribe } from './service';

const ctx = createWorkerCtx(env);

const passEnv = {
	RATE_LIMITER: { limit: async () => ({ success: true }) }
} as unknown as Env;
const blockedEnv = {
	RATE_LIMITER: { limit: async () => ({ success: false }) }
} as unknown as Env;

const origin = 'https://example.com';
const ip = '203.0.113.1';

async function rows() {
	return ctx.db.select().from(newsletterSubscriber);
}

async function byEmail(email: string) {
	const [row] = await ctx.db
		.select()
		.from(newsletterSubscriber)
		.where(eq(newsletterSubscriber.email, email))
		.limit(1);
	return row;
}

async function seed(email: string, token: string, opts: { expiresInMs: number }) {
	await ctx.db.insert(newsletterSubscriber).values({
		email,
		status: 'pending',
		confirmTokenHash: await sha256Hex(token),
		confirmTokenExpiresAt: new Date(Date.now() + opts.expiresInMs)
	});
}

describe('newsletter subscribe', () => {
	it('creates a pending subscriber with a fresh confirm token', async () => {
		await subscribe(ctx, passEnv, origin, ip, { email: 'reader@example.com' });

		const row = await byEmail('reader@example.com');
		expect(row?.status).toBe('pending');
		expect(row?.confirmTokenHash).toBeTruthy();
		expect(row?.confirmTokenExpiresAt?.getTime()).toBeGreaterThan(Date.now());
		expect(row?.confirmedAt).toBeNull();
	});

	it('normalizes casing so variants collapse to one row', async () => {
		await subscribe(ctx, passEnv, origin, ip, { email: 'Reader@Example.com' });
		await subscribe(ctx, passEnv, origin, ip, { email: 'reader@example.com' });

		const all = await rows();
		expect(all).toHaveLength(1);
		expect(all[0]?.email).toBe('reader@example.com');
	});

	it('resolves identically for a new and an already-pending address, rotating the token', async () => {
		await expect(
			subscribe(ctx, passEnv, origin, ip, { email: 'a@example.com' })
		).resolves.toBeUndefined();
		const first = await byEmail('a@example.com');

		await expect(
			subscribe(ctx, passEnv, origin, ip, { email: 'a@example.com' })
		).resolves.toBeUndefined();
		const second = await byEmail('a@example.com');

		expect(second?.status).toBe('pending');
		expect(second?.confirmTokenHash).not.toBe(first?.confirmTokenHash);
		expect(await rows()).toHaveLength(1);
	});

	it('does not re-issue a token or resolve differently for a confirmed address', async () => {
		await ctx.db.insert(newsletterSubscriber).values({
			email: 'done@example.com',
			status: 'confirmed',
			confirmTokenHash: null,
			confirmedAt: new Date()
		});

		await expect(
			subscribe(ctx, passEnv, origin, ip, { email: 'done@example.com' })
		).resolves.toBeUndefined();

		const row = await byEmail('done@example.com');
		expect(row?.status).toBe('confirmed');
		expect(row?.confirmTokenHash).toBeNull();
	});

	it('rejects a malformed email without creating a row', async () => {
		await expect(subscribe(ctx, passEnv, origin, ip, { email: 'nope' })).rejects.toMatchObject({
			code: 'invalid'
		});
		expect(await rows()).toHaveLength(0);
	});

	it('throws rate_limited and writes nothing when the limiter rejects', async () => {
		await expect(
			subscribe(ctx, blockedEnv, origin, ip, { email: 'blocked@example.com' })
		).rejects.toMatchObject({ code: 'rate_limited' });
		expect(await rows()).toHaveLength(0);
	});
});

describe('newsletter confirm', () => {
	it('marks a pending subscriber confirmed for a valid token', async () => {
		await seed('c@example.com', 'valid-token', { expiresInMs: 60_000 });

		await confirm(ctx, 'valid-token');

		const row = await byEmail('c@example.com');
		expect(row?.status).toBe('confirmed');
		expect(row?.confirmedAt).not.toBeNull();
	});

	it('is idempotent when the same link is followed twice', async () => {
		await seed('c@example.com', 'valid-token', { expiresInMs: 60_000 });

		await confirm(ctx, 'valid-token');
		await expect(confirm(ctx, 'valid-token')).resolves.toBeUndefined();

		const row = await byEmail('c@example.com');
		expect(row?.status).toBe('confirmed');
	});

	it('rejects an expired token', async () => {
		await seed('exp@example.com', 'stale-token', { expiresInMs: -1000 });

		await expect(confirm(ctx, 'stale-token')).rejects.toMatchObject({ code: 'invalid' });
		expect((await byEmail('exp@example.com'))?.status).toBe('pending');
	});

	it('rejects an unknown or empty token', async () => {
		await expect(confirm(ctx, 'never-issued')).rejects.toMatchObject({ code: 'invalid' });
		await expect(confirm(ctx, '')).rejects.toMatchObject({ code: 'invalid' });
		await expect(confirm(ctx, null)).rejects.toMatchObject({ code: 'invalid' });
	});
});
