import { eq } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { sha256Hex } from '$lib/utils/hash';
import { newsletterSubscriber } from '../db/schema';
import { newsletterConfirmEmail } from '../email/templates/newsletter-emails';
import { sendEmail } from '../email/service';
import { AppError } from '../errors';
import { verifyTurnstile } from '../turnstile';
import type { Ctx } from '../ctx';

const CONFIRM_TTL_MS = 24 * 60 * 60 * 1000;

export const subscribeSchema = createInsertSchema(newsletterSubscriber, {
	email: (s) => s.trim().toLowerCase().pipe(z.string().email().max(254))
}).pick({ email: true });

export type SubscribeInput = z.infer<typeof subscribeSchema>;

function newToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function subscribe(
	ctx: Ctx,
	env: Env,
	origin: string,
	ip: string,
	input: unknown,
	captchaToken?: string
): Promise<void> {
	const parsed = subscribeSchema.safeParse(input);
	if (!parsed.success) throw new AppError('invalid', 'Enter a valid email address');
	const { email } = parsed.data;

	await verifyTurnstile(env, captchaToken, ip);

	const { success } = await env.RATE_LIMITER.limit({ key: `newsletter:${ip}` });
	if (!success) throw new AppError('rate_limited', 'Too many requests');

	const [existing] = await ctx.db
		.select({ status: newsletterSubscriber.status })
		.from(newsletterSubscriber)
		.where(eq(newsletterSubscriber.email, email))
		.limit(1);

	if (existing?.status === 'confirmed') return;

	const token = newToken();
	const confirmTokenHash = await sha256Hex(token);
	const confirmTokenExpiresAt = new Date(Date.now() + CONFIRM_TTL_MS);

	await ctx.db
		.insert(newsletterSubscriber)
		.values({ email, status: 'pending', confirmTokenHash, confirmTokenExpiresAt })
		.onConflictDoUpdate({
			target: newsletterSubscriber.email,
			set: { status: 'pending', confirmTokenHash, confirmTokenExpiresAt, unsubscribedAt: null }
		});

	const url = `${origin}/newsletter/confirm?token=${token}`;
	ctx.waitUntil(sendEmail(env, newsletterConfirmEmail(email, url)));
}

export async function confirm(ctx: Ctx, token: string | null | undefined): Promise<void> {
	if (!token) throw new AppError('invalid', 'Invalid or expired confirmation link');

	const hash = await sha256Hex(token);
	const [row] = await ctx.db
		.select()
		.from(newsletterSubscriber)
		.where(eq(newsletterSubscriber.confirmTokenHash, hash))
		.limit(1);

	if (!row) throw new AppError('invalid', 'Invalid or expired confirmation link');
	if (row.status === 'confirmed') return;
	if (row.confirmTokenExpiresAt && row.confirmTokenExpiresAt.getTime() < Date.now())
		throw new AppError('invalid', 'Invalid or expired confirmation link');

	await ctx.db
		.update(newsletterSubscriber)
		.set({ status: 'confirmed', confirmedAt: new Date() })
		.where(eq(newsletterSubscriber.id, row.id));
}
