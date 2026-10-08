import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createWorkerCtx } from './ctx';
import { invitation, member, organization, purchase, user } from './db/schema';
import { authMethods, createAuth } from './auth';

const ctx = createWorkerCtx(env);
const ORIGIN = 'http://localhost:8787';

const auth = createAuth(
	{
		...env,
		EMAIL: undefined,
		EMAIL_DEBUG: 'true',
		CREEM_PRODUCT_PRO: 'prod_pro',
		CREEM_PRODUCT_LIFETIME: 'prod_life',
		R2_PUBLIC_URL: 'https://cdn.example.com'
	},
	ORIGIN
);
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

async function signInWithOrg(email: string) {
	const body = { email, password: 'a-good-password', name: 'Inviter' };
	await auth.api.signUpEmail({ body });
	const token = linkFrom(
		emails.find((e) => e.subject === 'Confirm your email')?.body
	).searchParams.get('token');
	await auth.api.verifyEmail({ query: { token: token! } });
	const signed = await auth.api.signInEmail({ body, returnHeaders: true });
	const cookie = (signed.headers.get('set-cookie') ?? '').split(';')[0]!;
	const headers = new Headers({ cookie });
	const [created] = await ctx.db.select().from(user).where(eq(user.email, email));
	const [membership] = await ctx.db.select().from(member).where(eq(member.userId, created!.id));
	return { headers, userId: created!.id, orgId: membership!.organizationId };
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

describe('invite member limits', () => {
	function buy(orgId: string, productId: string, orderId: string) {
		return ctx.db.insert(purchase).values({
			id: crypto.randomUUID(),
			organizationId: orgId,
			creemOrderId: orderId,
			creemCustomerId: `cust_${orderId}`,
			creemProductId: productId,
			status: 'paid',
			purchasedAt: new Date()
		});
	}

	it('lets an org on a one-time (lifetime) purchase invite past the free member cap', async () => {
		const { headers, orgId } = await signInWithOrg('lifetime@example.com');
		await buy(orgId, 'prod_life', 'order_life');

		await auth.api.createInvitation({
			body: { email: 'second@example.com', role: 'member', organizationId: orgId },
			headers
		});

		const invites = await ctx.db
			.select()
			.from(invitation)
			.where(eq(invitation.organizationId, orgId));
		expect(invites).toHaveLength(1);
	});

	it('does not count expired pending invitations against the member cap', async () => {
		const { headers, orgId, userId } = await signInWithOrg('expiry@example.com');
		await buy(orgId, 'prod_pro', 'order_pro');
		await ctx.db.insert(invitation).values([
			...Array.from({ length: 8 }, (_, i) => ({
				id: `live-${i}`,
				organizationId: orgId,
				email: `live${i}@example.com`,
				role: 'member',
				status: 'pending',
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
				inviterId: userId
			})),
			{
				id: 'dead-0',
				organizationId: orgId,
				email: 'dead@example.com',
				role: 'member',
				status: 'pending',
				expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
				inviterId: userId
			}
		]);

		await auth.api.createInvitation({
			body: { email: 'ninth@example.com', role: 'member', organizationId: orgId },
			headers
		});

		expect(
			await ctx.db.select().from(invitation).where(eq(invitation.organizationId, orgId))
		).toHaveLength(10);
	});
});

describe('profile image guard', () => {
	it('only stores an avatar URL from the configured R2 origin', async () => {
		const { headers, userId } = await signInWithOrg('image@example.com');
		const load = async () => (await ctx.db.select().from(user).where(eq(user.id, userId)))[0]!;

		await auth.api.updateUser({
			body: { image: 'https://cdn.example.com/avatars/me?v=2' },
			headers
		});
		expect((await load()).image).toBe('https://cdn.example.com/avatars/me?v=2');

		await auth.api.updateUser({
			body: { name: 'Renamed', image: 'https://evil.example.com/track.png' },
			headers
		});
		expect((await load()).name).toBe('Renamed');
		expect((await load()).image).toBe('https://cdn.example.com/avatars/me?v=2');

		await expect(
			auth.api.updateUser({ body: { image: 'https://evil.example.com/track.png' }, headers })
		).rejects.toThrow();
		expect((await load()).image).toBe('https://cdn.example.com/avatars/me?v=2');

		await auth.api.updateUser({ body: { image: '' }, headers });
		expect((await load()).image).toBe('');
	});
});
