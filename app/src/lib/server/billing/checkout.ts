import { eq } from 'drizzle-orm';
import { subscription, user } from '../db/schema';
import { AppError } from '../errors';
import { captureServer } from '../analytics/service';
import { requirePermission } from '../orgs/service';
import { cancelCreemSubscription, createCheckoutSession, createPortalSession } from './creem';
import type { Actor, Ctx } from '../ctx';

export async function startCheckout(
	ctx: Ctx,
	env: Env,
	actor: Actor,
	orgId: string,
	input: { productId: string; successUrl: string }
) {
	await requirePermission(ctx, actor, orgId, { billing: ['manage'] });

	const [buyer] = await ctx.db.select().from(user).where(eq(user.id, actor.id));
	if (!buyer) throw new AppError('not_found', 'User not found');

	const checkout = await createCheckoutSession(env, {
		productId: input.productId,
		successUrl: input.successUrl,
		email: buyer.email,
		requestId: crypto.randomUUID(),
		metadata: { organizationId: orgId, userId: actor.id }
	});

	console.log({ event: 'billing.checkout_started', orgId, checkoutId: checkout.id });
	ctx.waitUntil(
		captureServer(env, {
			event: 'checkout_started',
			distinctId: actor.id,
			properties: { orgId, productId: input.productId }
		})
	);
	return checkout.url;
}

export async function openBillingPortal(ctx: Ctx, env: Env, actor: Actor, orgId: string) {
	await requirePermission(ctx, actor, orgId, { billing: ['manage'] });

	const [row] = await ctx.db
		.select()
		.from(subscription)
		.where(eq(subscription.organizationId, orgId));
	if (!row) throw new AppError('not_found', 'No subscription for this organization');

	return createPortalSession(env, row.creemCustomerId);
}

export async function cancelSubscription(
	ctx: Ctx,
	env: Env,
	actor: Actor,
	orgId: string,
	mode: 'immediate' | 'scheduled' = 'scheduled'
) {
	await requirePermission(ctx, actor, orgId, { billing: ['manage'] });

	const [row] = await ctx.db
		.select()
		.from(subscription)
		.where(eq(subscription.organizationId, orgId));
	if (!row) throw new AppError('not_found', 'No subscription for this organization');

	await cancelCreemSubscription(env, row.creemSubscriptionId, mode);
	console.log({ event: 'billing.cancel_requested', orgId, mode });
	ctx.waitUntil(
		captureServer(env, {
			event: 'subscription_canceled',
			distinctId: actor.id,
			properties: { orgId, mode }
		})
	);
}
