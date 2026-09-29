import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { AVATAR_MAX_BYTES } from '$lib/avatar';
import { user } from '../db/schema';
import { createWorkerCtx, type Actor } from '../ctx';
import {
	avatarUploadTarget,
	completeOnboarding,
	confirmAvatarUpload,
	eraseUserData,
	storageConfigured
} from './service';

const configured = {
	...env,
	R2_ACCESS_KEY_ID: 'akia-test',
	R2_SECRET_ACCESS_KEY: 'secret-test',
	R2_ACCOUNT_ID: 'acct123',
	R2_BUCKET: 'bucket',
	R2_PUBLIC_URL: 'https://cdn.example.com/'
} as Env;

const png = { contentType: 'image/png', size: 1024 };

const ctx = createWorkerCtx(env);

let alice: Actor;
let bob: Actor;

beforeEach(async () => {
	const rows = await ctx.db
		.insert(user)
		.values([
			{ id: crypto.randomUUID(), name: 'Alice', email: 'alice@example.com' },
			{ id: crypto.randomUUID(), name: 'Bob', email: 'bob@example.com' }
		])
		.returning();
	alice = { id: rows[0]!.id };
	bob = { id: rows[1]!.id };
});

describe('completeOnboarding', () => {
	it('stamps onboardedAt for the acting user only', async () => {
		expect((await load(alice.id)).onboardedAt).toBeNull();

		const updated = await completeOnboarding(ctx, alice);
		expect(updated.onboardedAt).toBeInstanceOf(Date);

		expect((await load(alice.id)).onboardedAt).toBeInstanceOf(Date);
		expect((await load(bob.id)).onboardedAt).toBeNull();
	});

	async function load(id: string) {
		const [row] = await ctx.db.select().from(user).where(eq(user.id, id));
		return row!;
	}
});

describe('avatar upload target', () => {
	it('reports storage unconfigured and refuses to presign', async () => {
		expect(storageConfigured(env)).toBe(false);
		await expect(avatarUploadTarget(env, alice, png)).rejects.toMatchObject({ code: 'invalid' });
	});

	it('presigns an actor-scoped key with the content type bound when configured', async () => {
		const { uploadUrl } = await avatarUploadTarget(configured, alice, png);

		expect(uploadUrl).toContain(`acct123.r2.cloudflarestorage.com/bucket/avatars/${alice.id}`);
		expect(uploadUrl).toContain('X-Amz-Signature=');
		expect(new URL(uploadUrl).searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
	});

	it('refuses a disallowed type or an oversized file before signing', async () => {
		await expect(
			avatarUploadTarget(configured, alice, { contentType: 'application/pdf', size: 1024 })
		).rejects.toMatchObject({ code: 'invalid' });
		await expect(
			avatarUploadTarget(configured, alice, {
				contentType: 'image/png',
				size: AVATAR_MAX_BYTES + 1
			})
		).rejects.toMatchObject({ code: 'invalid' });
	});

	it('confirm refuses when storage is unconfigured', async () => {
		await expect(confirmAvatarUpload(ctx, env, alice)).rejects.toMatchObject({ code: 'invalid' });
	});

	it('eraseUserData is a no-op (never throws) when storage is unconfigured', async () => {
		await expect(eraseUserData(env, alice.id)).resolves.toBeUndefined();
	});
});
