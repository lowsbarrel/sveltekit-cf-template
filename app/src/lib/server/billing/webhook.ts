import { and, eq, sql } from 'drizzle-orm';
import { can } from '$lib/permissions';
import { planName } from '$lib/plan-display';
import { FREE_PLAN, planById } from '$lib/plans';
import { SITE } from '$lib/site';
import { baseLocale, isLocale } from '$lib/paraglide/runtime';
import { member, purchase, subscription, user, webhookEvent } from '../db/schema';
import { sendEmail } from '../email/service';
import {
	billingActiveEmail,
	billingCanceledEmail,
	billingLifetimeEmail,
	billingPaymentFailedEmail,
	billingRenewedEmail
} from '../email/templates/billing-emails';
import { purchaseFromEvent, subscriptionFromEvent } from './creem';
import { planForProductId } from './plans';
import { classifyBillingTransition, ENTITLED_STATUSES } from './entitlement';
import type { BillingTransition } from './entitlement';
import type { VerifiedEvent } from './creem';
import type { EmailContent } from '../email/service';
import type { Ctx } from '../ctx';
import type { Locale } from '$lib/locale';

type ApplyStatus = 'applied' | 'duplicate' | 'ignored' | 'unmapped' | 'stale';

type ApplyResult = { status: ApplyStatus };

type ApplyOutcome = {
	status: ApplyStatus;
	transition?: BillingTransition | null;
	orgId?: string;
	planId?: string;
	unknownProduct?: boolean;
};

export async function applyWebhookEvent(
	ctx: Ctx,
	env: Env,
	event: VerifiedEvent
): Promise<ApplyResult> {
	const outcome = await ctx.db.transaction<ApplyOutcome>(async (tx) => {
		const claimed = await tx
			.insert(webhookEvent)
			.values({ id: event.id, provider: 'creem', eventType: event.type })
			.onConflictDoNothing()
			.returning();

		if (claimed.length === 0) {
			console.log({ event: 'billing.webhook_duplicate', id: event.id, type: event.type });
			return { status: 'duplicate' } as const;
		}

		const snapshot = subscriptionFromEvent(event);
		if (!snapshot) {
			const order = purchaseFromEvent(event);
			if (!order) {
				console.log({ event: 'billing.webhook_ignored', id: event.id, type: event.type });
				return { status: 'ignored' } as const;
			}

			if (order.status === 'refunded') {
				const [refunded] = await tx
					.update(purchase)
					.set({ status: 'refunded' })
					.where(and(eq(purchase.creemOrderId, order.creemOrderId), eq(purchase.status, 'paid')))
					.returning();
				if (!refunded) {
					console.log({ event: 'billing.webhook_ignored', id: event.id, type: event.type });
					return { status: 'ignored' } as const;
				}
				console.log({
					event: 'billing.webhook_applied',
					id: event.id,
					type: event.type,
					status: 'refunded'
				});
				return {
					status: 'applied',
					transition: 'canceled',
					orgId: refunded.organizationId,
					planId: planForProductId(env, refunded.creemProductId).id
				} as const;
			}

			const purchaseOrgId = order.organizationId;
			if (!purchaseOrgId) {
				console.warn({ event: 'billing.webhook_unmapped', id: event.id, type: event.type });
				return { status: 'unmapped' } as const;
			}

			const purchasePlan = planForProductId(env, order.creemProductId);
			const purchaseUnknownProduct = !purchasePlan.paid && !!order.creemProductId;
			if (purchaseUnknownProduct) {
				console.error({
					event: 'billing.webhook_unknown_product',
					id: event.id,
					orgId: purchaseOrgId,
					productId: order.creemProductId
				});
			}

			const inserted = await tx
				.insert(purchase)
				.values({
					id: crypto.randomUUID(),
					organizationId: purchaseOrgId,
					creemOrderId: order.creemOrderId,
					creemCustomerId: order.creemCustomerId,
					creemProductId: order.creemProductId,
					status: 'paid',
					purchasedAt: order.purchasedAt
				})
				.onConflictDoNothing({ target: purchase.creemOrderId })
				.returning();

			if (inserted.length === 0) {
				console.log({ event: 'billing.webhook_stale', id: event.id, type: event.type });
				return { status: 'stale' } as const;
			}

			console.log({
				event: 'billing.webhook_applied',
				id: event.id,
				type: event.type,
				status: 'paid'
			});
			return {
				status: 'applied',
				transition: 'active',
				orgId: purchaseOrgId,
				planId: purchasePlan.id,
				unknownProduct: purchaseUnknownProduct
			} as const;
		}

		const eventAt = new Date(event.createdAt);

		let orgId = snapshot.organizationId;
		if (!orgId) {
			const [bySub] = await tx
				.select()
				.from(subscription)
				.where(eq(subscription.creemSubscriptionId, snapshot.creemSubscriptionId));
			orgId = bySub?.organizationId ?? null;
		}
		if (!orgId) {
			console.warn({ event: 'billing.webhook_unmapped', id: event.id, type: event.type });
			return { status: 'unmapped' } as const;
		}

		const [current] = await tx
			.select()
			.from(subscription)
			.where(eq(subscription.organizationId, orgId));
		const sameSub = current?.creemSubscriptionId === snapshot.creemSubscriptionId;

		if (current) {
			if (sameSub) {
				if (current.lastEventAt >= eventAt) {
					console.log({ event: 'billing.webhook_stale', id: event.id, type: event.type });
					return { status: 'stale' } as const;
				}
			} else if (!ENTITLED_STATUSES[snapshot.status]) {
				console.log({ event: 'billing.webhook_stale', id: event.id, type: event.type });
				return { status: 'stale' } as const;
			}
		}

		const values = {
			creemCustomerId: snapshot.creemCustomerId,
			creemSubscriptionId: snapshot.creemSubscriptionId,
			creemProductId: snapshot.creemProductId,
			status: snapshot.status,
			currentPeriodEnd:
				snapshot.currentPeriodEnd ?? (sameSub ? current?.currentPeriodEnd : null) ?? null,
			lastEventAt: eventAt
		};

		const plan = planForProductId(env, snapshot.creemProductId);
		const unknownProduct = !plan.paid && !!snapshot.creemProductId;
		if (unknownProduct) {
			console.error({
				event: 'billing.webhook_unknown_product',
				id: event.id,
				orgId,
				productId: snapshot.creemProductId
			});
		}

		const transition = classifyBillingTransition(current, {
			status: values.status,
			currentPeriodEnd: values.currentPeriodEnd
		});

		await tx
			.insert(subscription)
			.values({ id: crypto.randomUUID(), organizationId: orgId, ...values })
			.onConflictDoUpdate({
				target: subscription.organizationId,
				set: values,
				setWhere: sql`${subscription.creemSubscriptionId} <> ${values.creemSubscriptionId} or ${subscription.lastEventAt} <= ${eventAt.toISOString()}::timestamptz`
			});

		console.log({
			event: 'billing.webhook_applied',
			id: event.id,
			type: event.type,
			status: snapshot.status
		});
		return { status: 'applied', transition, orgId, planId: plan.id, unknownProduct };
	});

	if (
		outcome.status === 'applied' &&
		outcome.transition &&
		!outcome.unknownProduct &&
		outcome.orgId &&
		outcome.planId
	) {
		ctx.waitUntil(
			notifyBillingManagers(ctx, env, outcome.orgId, outcome.transition, outcome.planId)
		);
	}

	return { status: outcome.status };
}

const BILLING_EMAILS: Record<
	BillingTransition,
	(to: string, plan: string, url: string, locale: Locale) => EmailContent
> = {
	active: billingActiveEmail,
	renewed: billingRenewedEmail,
	canceled: billingCanceledEmail,
	payment_failed: billingPaymentFailedEmail
};

async function notifyBillingManagers(
	ctx: Ctx,
	env: Env,
	orgId: string,
	transition: BillingTransition,
	planId: string
) {
	const rows = await ctx.db
		.select({ email: user.email, locale: user.locale, role: member.role })
		.from(member)
		.innerJoin(user, eq(member.userId, user.id))
		.where(eq(member.organizationId, orgId));
	const managers = rows.filter((r) => can(r.role, { billing: ['manage'] }));
	if (managers.length === 0) return;

	const plan = planById(planId) ?? FREE_PLAN;
	const url = `${SITE.url}/app/billing`;
	const buildEmail =
		transition === 'active' && plan.oneTime ? billingLifetimeEmail : BILLING_EMAILS[transition];

	await Promise.all(
		managers.map((r) => {
			const locale = isLocale(r.locale) ? r.locale : baseLocale;
			return sendEmail(env, buildEmail(r.email, planName(plan, { locale }), url, locale));
		})
	);
}
