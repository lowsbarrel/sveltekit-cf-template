import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { member, organization, user } from '../db/schema';
import { createWorkerCtx, type Actor } from '../ctx';
import { mintRealtimeToken, verifyRealtimeToken } from './service';

const ctx = createWorkerCtx(env);
const SECRET = 'test-realtime-secret';
const rtEnv = { ...env, REALTIME_SECRET: SECRET, PUBLIC_REALTIME_URL: 'wss://rt.example.dev' };

const orgA = 'rt-org-a';
let insider: Actor;
let outsider: Actor;

beforeEach(async () => {
	const rows = await ctx.db
		.insert(user)
		.values([
			{ id: crypto.randomUUID(), name: 'Insider', email: 'rt-insider@example.com' },
			{ id: crypto.randomUUID(), name: 'Outsider', email: 'rt-outsider@example.com' }
		])
		.returning();
	insider = { id: rows[0]!.id };
	outsider = { id: rows[1]!.id };

	await ctx.db.insert(organization).values({ id: orgA, name: 'RT', slug: 'rt' });
	await ctx.db
		.insert(member)
		.values({ id: crypto.randomUUID(), organizationId: orgA, userId: insider.id, role: 'member' });
});

describe('realtime capability token', () => {
	it('mints for a member and round-trips through verify, org-prefixing the room', async () => {
		const { token, url, room } = await mintRealtimeToken(ctx, rtEnv, insider, orgA, 'notes');
		expect(url).toBe('wss://rt.example.dev');
		expect(room).toBe(`${orgA}:notes`);

		const claims = await verifyRealtimeToken(SECRET, token);
		expect(claims).toMatchObject({ sub: insider.id, room: `${orgA}:notes` });
	});

	it('refuses to mint for a non-member', async () => {
		await expect(mintRealtimeToken(ctx, rtEnv, outsider, orgA, 'notes')).rejects.toMatchObject({
			code: 'forbidden'
		});
	});

	it('rejects a tampered token', async () => {
		const { token } = await mintRealtimeToken(ctx, rtEnv, insider, orgA, 'notes');
		const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A');
		expect(await verifyRealtimeToken(SECRET, tampered)).toBeNull();
	});

	it('rejects a token signed with a different secret', async () => {
		const { token } = await mintRealtimeToken(ctx, rtEnv, insider, orgA, 'notes');
		expect(await verifyRealtimeToken('a-different-secret', token)).toBeNull();
	});
});
