import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { captcha, haveIBeenPwned, magicLink, twoFactor } from 'better-auth/plugins';
import { organization } from 'better-auth/plugins/organization';
import { passkey } from '@better-auth/passkey';
import { and, count, eq, gt } from 'drizzle-orm';
import * as m from '$lib/paraglide/messages';
import { baseLocale, isLocale } from '$lib/paraglide/runtime';
import { ac, roles } from '$lib/permissions';
import { SITE } from '$lib/site';
import { createDb, type Ctx } from './ctx';
import { eraseUserData, ownsEntitledOrg } from './account/service';
import { planForOrg } from './billing/entitlement';
import {
	changeEmailEmail,
	deleteAccountEmail,
	invitationEmail,
	magicLinkEmail,
	resetPasswordEmail,
	verifyEmail,
	welcomeEmail
} from './email/templates/auth-emails';
import * as schema from './db/schema';
import { sendEmail } from './email/service';
import type { Locale } from '$lib/locale';
import type { RequestEvent } from '@sveltejs/kit';

type AuthContext = {
	getRequestEvent?: () => RequestEvent | undefined;
	waitUntil?: (promise: Promise<unknown>) => void;
};

export function authMethods(env: Env) {
	return {
		google: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
		email: !!env.EMAIL || !!env.EMAIL_DEBUG
	};
}

export function createAuth(env: Env, baseURL: string, ctx: AuthContext = {}) {
	if (!env.BETTER_AUTH_SECRET) {
		throw new Error(
			'BETTER_AUTH_SECRET is not set - .dev.vars locally, `wrangler secret put` in production'
		);
	}
	const db = createDb(env);
	const dbCtx: Ctx = {
		db,
		dbCached: db,
		waitUntil: ctx.waitUntil ?? ((promise) => void promise.catch(() => {})),
		close: async () => {}
	};
	const methods = authMethods(env);

	const localeFor = async (email: string): Promise<Locale> => {
		const [row] = await db
			.select({ locale: schema.user.locale })
			.from(schema.user)
			.where(eq(schema.user.email, email))
			.limit(1);
		const value = row?.locale;
		return isLocale(value) ? value : baseLocale;
	};

	if (!methods.email) {
		console.warn({
			event: 'auth.email_verification_disabled',
			reason: 'no send_email binding and no EMAIL_DEBUG - password signups are unverified'
		});
	}

	return betterAuth({
		database: drizzleAdapter(db, { provider: 'pg', schema }),
		secret: env.BETTER_AUTH_SECRET,
		baseURL,
		rateLimit: {
			enabled: true,
			storage: 'database',
			customRules: {
				'/sign-in/magic-link': { window: 60, max: 3 },
				'/request-password-reset': { window: 60, max: 3 },
				'/sign-up/email': { window: 60, max: 3 },
				'/send-verification-email': { window: 60, max: 3 },
				'/organization/invite-member': { window: 60, max: 5 },
				'/change-email': { window: 60, max: 3 },
				'/delete-user': { window: 60, max: 3 },
				'/two-factor/verify-totp': { window: 60, max: 10 },
				'/two-factor/verify-backup-code': { window: 60, max: 10 }
			}
		},
		// session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
		advanced: {
			ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
			...(ctx.waitUntil
				? { backgroundTasks: { handler: (p: Promise<unknown>) => ctx.waitUntil!(p) } }
				: {})
		},
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: methods.email,
			sendResetPassword: async ({ user, url }) => {
				await sendEmail(env, resetPasswordEmail(user.email, url, await localeFor(user.email)));
			}
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			expiresIn: 60 * 60,
			sendVerificationEmail: async ({ user, url }) => {
				await sendEmail(env, verifyEmail(user.email, url, await localeFor(user.email)));
			}
		},
		socialProviders: methods.google
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID!,
						clientSecret: env.GOOGLE_CLIENT_SECRET!
					}
				}
			: {},
		account: {
			accountLinking: {
				enabled: true,
				trustedProviders: ['google']
			}
		},
		user: {
			additionalFields: {
				locale: { type: 'string', required: false, input: false },
				onboardedAt: { type: 'date', required: false, input: false }
			},
			changeEmail: {
				enabled: true,
				sendChangeEmailVerification: async ({
					user,
					newEmail,
					url
				}: {
					user: { email: string };
					newEmail: string;
					url: string;
				}) => {
					await sendEmail(
						env,
						changeEmailEmail(user.email, newEmail, url, await localeFor(user.email))
					);
				}
			},
			deleteUser: {
				enabled: true,
				sendDeleteAccountVerification: async ({
					user,
					url
				}: {
					user: { email: string };
					url: string;
				}) => {
					await sendEmail(env, deleteAccountEmail(user.email, url, await localeFor(user.email)));
				},
				beforeDelete: async (account) => {
					if (await ownsEntitledOrg(dbCtx, env, { id: account.id })) {
						throw new APIError('BAD_REQUEST', {
							message: 'Cancel your subscription before deleting your account.'
						});
					}
				},
				afterDelete: async (account) => {
					await eraseUserData(env, account.id);
				}
			}
		},
		databaseHooks: {
			user: {
				create: {
					before: async (userData) => {
						let cookie: string | undefined;
						try {
							cookie = ctx.getRequestEvent?.()?.cookies.get('PARAGLIDE_LOCALE');
						} catch {}
						return { data: { ...userData, locale: isLocale(cookie) ? cookie : baseLocale } };
					},
					after: async (created) => {
						const orgId = crypto.randomUUID();
						const label = created.name?.trim() || created.email.split('@')[0] || created.email;
						await db.transaction(async (tx) => {
							await tx.insert(schema.organization).values({
								id: orgId,
								name: `${label}'s workspace`,
								slug: `w-${created.id}`
							});
							await tx.insert(schema.member).values({
								id: crypto.randomUUID(),
								organizationId: orgId,
								userId: created.id,
								role: 'owner'
							});
						});
						const welcome = sendEmail(
							env,
							welcomeEmail(created.email, label, `${baseURL}/app`, await localeFor(created.email))
						);
						if (ctx.waitUntil) ctx.waitUntil(welcome);
						else void welcome.catch(() => {});
					}
				},
				update: {
					before: async (data) => {
						const image = data.image;
						if (image === undefined || image === null || image === '') return;
						let allowed = false;
						try {
							allowed =
								!!env.R2_PUBLIC_URL && new URL(image).origin === new URL(env.R2_PUBLIC_URL).origin;
						} catch {}
						if (allowed) return;
						const sanitized = { ...data, image: undefined };
						if (Object.values(sanitized).every((value) => value === undefined)) {
							throw new APIError('BAD_REQUEST', { message: 'Invalid image URL' });
						}
						return { data: sanitized };
					}
				}
			},
			session: {
				create: {
					before: async (session) => {
						const [first] = await db
							.select()
							.from(schema.member)
							.where(eq(schema.member.userId, session.userId))
							.limit(1);
						return { data: { ...session, activeOrganizationId: first?.organizationId ?? null } };
					}
				}
			}
		},
		plugins: [
			organization({
				ac,
				roles,
				invitationExpiresIn: 60 * 60 * 24 * 7,
				sendInvitationEmail: async (data) => {
					const url = `${baseURL}/accept-invitation/${data.id}`;
					await sendEmail(
						env,
						invitationEmail(
							data.email,
							data.organization.name,
							data.inviter.user.name,
							url,
							await localeFor(data.email)
						)
					);
				},
				organizationHooks: {
					beforeCreateInvitation: async (data) => {
						const orgId = data.invitation.organizationId;
						// ponytail: better-auth inserts the invitation after this hook, so concurrent invites can overshoot maxMembers by the number of simultaneous requests; upgrade = a DB constraint
						const [[members], [pending], plan] = await Promise.all([
							db
								.select({ n: count() })
								.from(schema.member)
								.where(eq(schema.member.organizationId, orgId)),
							db
								.select({ n: count() })
								.from(schema.invitation)
								.where(
									and(
										eq(schema.invitation.organizationId, orgId),
										eq(schema.invitation.status, 'pending'),
										gt(schema.invitation.expiresAt, new Date())
									)
								),
							planForOrg(dbCtx, env, orgId)
						]);
						const limit = plan.limits.maxMembers;
						const used = (members?.n ?? 0) + (pending?.n ?? 0);
						if (limit !== null && used >= limit) {
							throw new APIError('FORBIDDEN', {
								message: m.team_invite_limit_reached({ count: limit })
							});
						}
					}
				}
			}),
			magicLink({
				expiresIn: 60 * 15,
				sendMagicLink: async ({ email, url }) => {
					await sendEmail(env, magicLinkEmail(email, url, await localeFor(email)));
				}
			}),
			twoFactor({ issuer: SITE.name }),
			passkey({ rpID: new URL(baseURL).hostname, rpName: SITE.name, origin: baseURL }),
			haveIBeenPwned({
				customPasswordCompromisedMessage:
					'This password has appeared in a known data breach. Please choose a different one.'
			}),
			...(env.TURNSTILE_SECRET_KEY
				? [captcha({ provider: 'cloudflare-turnstile', secretKey: env.TURNSTILE_SECRET_KEY })]
				: []),
			sveltekitCookies((() => ctx.getRequestEvent?.()) as () => RequestEvent)
		]
	});
}

export type Session = ReturnType<typeof createAuth>['$Infer']['Session'];
