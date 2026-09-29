import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createWorkerCtx } from './ctx';
import { member, organization, user } from './db/schema';
import { authMethods, createAuth } from './auth';

const ctx = createWorkerCtx(env);
const ORIGIN = 'http://localhost:8787';

const auth = createAuth({ ...env, EMAIL: undefined, EMAIL_DEBUG: 'true' }, ORIGIN);
const credentials = { email: 'verify@example.com', password: 'a-good-password', name: 'Verify' };

let emails: { to: string; subject: string; body?: string }[] = [];

beforeEach(() => {
	emails = [];
	vi.spyOn(console, 'log').mockImplementation((entry: unknown) => {
		const line = entry as { event?: string; to: string; subject: string; body?: string };
		if (line?.event === 'email.skipped') emails.push(line);
	});
});

afterEach(() => vi.restoreAllMocks());

function linkFrom(body: string | undefined) {
	const match = body?.match(/https?:\/\/\S+/);
	if (!match) throw new Error('no link in email body - is EMAIL_DEBUG set in .dev.vars?');
	return new URL(match[0]);
}

describe('authMethods', () => {
	it('reports email as usable only when mail can actually leave', () => {
		expect(authMethods({ ...env, EMAIL: undefined, EMAIL_DEBUG: undefined }).email).toBe(false);
		expect(authMethods({ ...env, EMAIL: undefined, EMAIL_DEBUG: 'true' }).email).toBe(true);
	});

	it('reports google as unusable unless BOTH halves of the credential are set', () => {
		const half = { ...env, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: undefined };
		expect(authMethods(half).google).toBe(false);
		expect(authMethods({ ...half, GOOGLE_CLIENT_SECRET: 'secret' }).google).toBe(true);
	});
});

describe('email verification', () => {
	it('refuses to sign in a password user until the address is proven', async () => {
		await auth.api.signUpEmail({ body: credentials });

		const [created] = await ctx.db.select().from(user).where(eq(user.email, credentials.email));
		expect(created!.emailVerified).toBe(false);

		await expect(
			auth.api.signInEmail({
				body: { email: credentials.email, password: credentials.password }
			})
		).rejects.toThrow();
	});

	it('sends a confirmation link on sign-up, and honouring it unlocks sign-in', async () => {
		await auth.api.signUpEmail({ body: credentials });

		const confirmation = emails.find((e) => e.subject === 'Confirm your email');
		expect(confirmation?.to).toBe('v***@example.com');

		const token = linkFrom(confirmation?.body).searchParams.get('token');
		expect(token).toBeTruthy();

		await auth.api.verifyEmail({ query: { token: token! } });

		const [verified] = await ctx.db.select().from(user).where(eq(user.email, credentials.email));
		expect(verified!.emailVerified).toBe(true);

		const session = await auth.api.signInEmail({
			body: { email: credentials.email, password: credentials.password }
		});
		expect(session.user.email).toBe(credentials.email);
	});
});

describe('signup side effects', () => {
	it('gives every new user an organization they own, so they can be billed', async () => {
		await auth.api.signUpEmail({ body: credentials });

		const [created] = await ctx.db.select().from(user).where(eq(user.email, credentials.email));
		const [membership] = await ctx.db.select().from(member).where(eq(member.userId, created!.id));

		expect(membership!.role).toBe('owner');

		const [org] = await ctx.db
			.select()
			.from(organization)
			.where(eq(organization.id, membership!.organizationId));
		expect(org!.name).toBe("Verify's workspace");
	});
});
