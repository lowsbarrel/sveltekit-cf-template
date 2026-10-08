import { eq } from 'drizzle-orm';
import { subscription, user } from '../db/schema';
import { AppError } from '../errors';
import { captureServerIfConsented } from '../analytics/service';
import { requirePermission } from '../orgs/service';
import { planForOrg } from './entitlement';
import { cancelCreemSubscription, createCheckoutSession, createPortalSession } from './creem';
import type { Actor, Ctx } from '../ctx';

export async function startCheckout(
	ctx: Ctx,
	env: Env,
	actor: Actor,
	orgId: string,
	input: { productId: string; successUrl: string; analytics: boolean }
) {
	await requirePermission(ctx, actor, orgId, { billing: ['manage'] });

	if ((await planForOrg(ctx, env, orgId)).paid) {
		throw new AppError('conflict', 'This organization is already on a paid plan');
	}

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
	captureServerIfConsented(ctx, env, input.analytics, {
		event: 'checkout_started',
		distinctId: actor.id,
		properties: { orgId, productId: input.productId }
	});
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
	analytics: boolean,
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
	captureServerIfConsented(ctx, env, analytics, {
		event: 'subscription_canceled',
		distinctId: actor.id,
		properties: { orgId, mode }
	});
}
