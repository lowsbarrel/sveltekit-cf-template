import { and, desc, eq } from 'drizzle-orm';
import { can } from '$lib/permissions';
import { bestPlan, FREE_PLAN, type Plan, type PlanLimits } from '$lib/plans';
import { purchase, subscription, webhookEvent } from '../db/schema';
import { AppError } from '../errors';
import { requirePermission } from '../orgs/service';
import { availablePlans, planForProductId } from './plans';
import type { Actor, Ctx } from '../ctx';

export const ENTITLED_STATUSES: Record<string, true> = {
	active: true,
	trialing: true,
	scheduled_cancel: true,
	paused: true
};

const ENTITLEMENT_GRACE_MS = 24 * 60 * 60 * 1000;

export function isEntitled(
	row: { status: string; currentPeriodEnd?: Date | null } | null | undefined
): boolean {
	if (!row || !ENTITLED_STATUSES[row.status]) return false;
	if (row.currentPeriodEnd && row.currentPeriodEnd.getTime() + ENTITLEMENT_GRACE_MS < Date.now()) {
		return false;
	}
	return true;
}

export type BillingTransition = 'active' | 'renewed' | 'canceled' | 'payment_failed';

type EntitlementRow = { status: string; currentPeriodEnd?: Date | null };

export function classifyBillingTransition(
	prev: EntitlementRow | null | undefined,
	next: EntitlementRow
): BillingTransition | null {
	if (next.status === 'past_due') {
		return prev?.status === 'past_due' ? null : 'payment_failed';
	}
	const was = isEntitled(prev);
	const now = isEntitled(next);
	if (!was && now) return 'active';
	if (was && !now) return 'canceled';
	if (was && now) {
		const prevEnd = prev?.currentPeriodEnd?.getTime() ?? 0;
		const nextEnd = next.currentPeriodEnd?.getTime() ?? 0;
		return nextEnd > prevEnd ? 'renewed' : null;
	}
	return null;
}

function paidPurchases(ctx: Ctx, orgId: string) {
	return ctx.db
		.select()
		.from(purchase)
		.where(and(eq(purchase.organizationId, orgId), eq(purchase.status, 'paid')));
}

function entitledPlans(
	env: Env,
	sub: { status: string; currentPeriodEnd?: Date | null; creemProductId: string } | undefined,
	purchases: { creemProductId: string }[]
): Plan[] {
	const plans: Plan[] = [];
	if (isEntitled(sub)) plans.push(planForProductId(env, sub!.creemProductId));
	for (const p of purchases) {
		const plan = planForProductId(env, p.creemProductId);
		if (plan.paid) plans.push(plan);
	}
	return plans;
}

export async function getBillingOverview(ctx: Ctx, env: Env, actor: Actor, orgId: string) {
	const membership = await requirePermission(ctx, actor, orgId, { billing: ['read'] });
	const [[row], purchases, [lastWebhook]] = await Promise.all([
		ctx.db.select().from(subscription).where(eq(subscription.organizationId, orgId)),
		paidPurchases(ctx, orgId),
		ctx.db
			.select({ at: webhookEvent.receivedAt })
			.from(webhookEvent)
			.where(eq(webhookEvent.provider, 'creem'))
			.orderBy(desc(webhookEvent.receivedAt))
			.limit(1)
	]);

	const plans = entitledPlans(env, row, purchases);
	const entitled = plans.length > 0;
	return {
		subscription: row ?? null,
		entitled,
		plan: entitled ? bestPlan(plans) : FREE_PLAN,
		availablePlans: availablePlans(env),
		canManage: can(membership.role, { billing: ['manage'] }),
		webhook: { secretSet: !!env.CREEM_WEBHOOK_SECRET, lastReceivedAt: lastWebhook?.at ?? null }
	};
}

export async function planForOrg(ctx: Ctx, env: Env, orgId: string): Promise<Plan> {
	const [[row], purchases] = await Promise.all([
		ctx.db.select().from(subscription).where(eq(subscription.organizationId, orgId)),
		paidPurchases(ctx, orgId)
	]);
	const plans = entitledPlans(env, row, purchases);
	return plans.length > 0 ? bestPlan(plans) : FREE_PLAN;
}

export async function requireWithinLimit(
	ctx: Ctx,
	env: Env,
	orgId: string,
	key: keyof PlanLimits,
	currentCount: number
) {
	const plan = await planForOrg(ctx, env, orgId);
	const limit = plan.limits[key];
	if (limit !== null && currentCount >= limit) {
		throw new AppError(
			'limit_reached',
			`You've reached your plan's limit of ${limit}. Upgrade to add more.`
		);
	}
}

export async function requireActiveSubscription(ctx: Ctx, orgId: string) {
	const [[row], purchases] = await Promise.all([
		ctx.db.select().from(subscription).where(eq(subscription.organizationId, orgId)),
		paidPurchases(ctx, orgId)
	]);
	if (isEntitled(row)) return row;
	if (purchases.length > 0) return purchases[0];
	throw new AppError('forbidden', 'This organization does not have an active subscription');
}
