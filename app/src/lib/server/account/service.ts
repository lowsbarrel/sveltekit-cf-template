import { and, desc, eq, gt, ne } from 'drizzle-orm';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '$lib/avatar';
import { account, member, passkey, session, user } from '../db/schema';
import { planForOrg } from '../billing/entitlement';
import { AppError } from '../errors';
import {
	assertUploadWithin,
	deleteObject,
	presignedUploadUrl,
	putObject,
	r2Configured,
	uploadedObjectMeta
} from '../storage/service';
import type { Actor, Ctx } from '../ctx';

const AVATAR_POLICY = { allowedTypes: AVATAR_TYPES, maxBytes: AVATAR_MAX_BYTES };

function avatarKey(actor: Actor): string {
	return `avatars/${actor.id}`;
}

export function storageConfigured(env: Env): boolean {
	return (
		!!env.R2_ACCESS_KEY_ID &&
		!!env.R2_SECRET_ACCESS_KEY &&
		!!env.R2_ACCOUNT_ID &&
		!!env.R2_BUCKET &&
		!!env.R2_PUBLIC_URL
	);
}

export async function avatarUploadTarget(
	env: Env,
	actor: Actor,
	file: { contentType: string; size: number }
) {
	if (!storageConfigured(env)) {
		throw new AppError('invalid', 'Image upload is not configured');
	}
	assertUploadWithin(file, AVATAR_POLICY);
	const uploadUrl = await presignedUploadUrl(env, avatarKey(actor), {
		contentType: file.contentType,
		contentLength: file.size,
		expiresIn: 300
	});
	return { uploadUrl };
}

export async function confirmAvatarUpload(ctx: Ctx, env: Env, actor: Actor) {
	if (!storageConfigured(env)) {
		throw new AppError('invalid', 'Image upload is not configured');
	}
	const key = avatarKey(actor);
	const meta = await uploadedObjectMeta(env, key);
	if (!meta) throw new AppError('invalid', 'No uploaded image found');
	try {
		assertUploadWithin({ contentType: meta.contentType, size: meta.size }, AVATAR_POLICY);
	} catch (e) {
		await deleteObject(env, key);
		throw e;
	}
	const base = env.R2_PUBLIC_URL!.replace(/\/+$/, '');
	const image = `${base}/${key}?v=${meta.etag ?? meta.size}`;
	const [updated] = await ctx.db
		.update(user)
		.set({ image })
		.where(eq(user.id, actor.id))
		.returning();
	if (!updated) throw new AppError('not_found', 'User not found');
	return { image };
}

export async function eraseUserData(env: Env, userId: string): Promise<void> {
	if (!r2Configured(env)) return;
	try {
		await putObject(
			env,
			`erasures/${userId}.json`,
			JSON.stringify({ userId, erasedAt: new Date().toISOString() }),
			{ contentType: 'application/json' }
		);
	} catch (e) {
		console.error({ event: 'erasure.tombstone_failed', userId }, e);
	}
	try {
		await deleteObject(env, avatarKey({ id: userId }));
	} catch (e) {
		console.error({ event: 'erasure.avatar_failed', userId }, e);
	}
}

export async function emailForUser(ctx: Ctx, userId: string): Promise<string | null> {
	const [found] = await ctx.db.select({ email: user.email }).from(user).where(eq(user.id, userId));
	return found?.email ?? null;
}

export async function completeOnboarding(ctx: Ctx, actor: Actor) {
	const [updated] = await ctx.db
		.update(user)
		.set({ onboardedAt: new Date() })
		.where(eq(user.id, actor.id))
		.returning();
	if (!updated) throw new AppError('not_found', 'User not found');
	return updated;
}

export async function hasPasswordCredential(ctx: Ctx, actor: Actor): Promise<boolean> {
	const rows = await ctx.db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, actor.id), eq(account.providerId, 'credential')));
	return rows.length > 0;
}

export async function listUserSessions(ctx: Ctx, actor: Actor) {
	return ctx.db
		.select({
			id: session.id,
			ipAddress: session.ipAddress,
			userAgent: session.userAgent,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			expiresAt: session.expiresAt
		})
		.from(session)
		.where(and(eq(session.userId, actor.id), gt(session.expiresAt, new Date())))
		.orderBy(desc(session.updatedAt));
}

export async function revokeSession(ctx: Ctx, actor: Actor, sessionId: string) {
	const [deleted] = await ctx.db
		.delete(session)
		.where(and(eq(session.id, sessionId), eq(session.userId, actor.id)))
		.returning();
	if (!deleted) throw new AppError('not_found', 'Session not found');
	return deleted;
}

export async function revokeOtherSessions(ctx: Ctx, actor: Actor, keepSessionId: string) {
	await ctx.db
		.delete(session)
		.where(and(eq(session.userId, actor.id), ne(session.id, keepSessionId)));
}

export async function ownsEntitledOrg(ctx: Ctx, env: Env, actor: Actor): Promise<boolean> {
	const owned = await ctx.db
		.select({ orgId: member.organizationId })
		.from(member)
		.where(and(eq(member.userId, actor.id), eq(member.role, 'owner')));
	const plans = await Promise.all(owned.map((o) => planForOrg(ctx, env, o.orgId)));
	return plans.some((plan) => plan.paid);
}

export async function listUserPasskeys(ctx: Ctx, actor: Actor) {
	return ctx.db
		.select({
			id: passkey.id,
			name: passkey.name,
			deviceType: passkey.deviceType,
			createdAt: passkey.createdAt
		})
		.from(passkey)
		.where(eq(passkey.userId, actor.id))
		.orderBy(desc(passkey.createdAt));
}

export async function deletePasskey(ctx: Ctx, actor: Actor, id: string) {
	const [deleted] = await ctx.db
		.delete(passkey)
		.where(and(eq(passkey.id, id), eq(passkey.userId, actor.id)))
		.returning();
	if (!deleted) throw new AppError('not_found', 'Passkey not found');
	return deleted;
}
