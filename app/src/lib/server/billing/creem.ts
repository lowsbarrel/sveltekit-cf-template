import { Creem } from 'creem';
import { constructWebhookEvent } from 'creem/webhooks';
import { z } from 'zod';
import { AppError } from '../errors';

function client(env: Env) {
	if (!env.CREEM_API_KEY) throw new AppError('internal', 'CREEM_API_KEY is not set');
	return new Creem({
		apiKey: env.CREEM_API_KEY,
		server: env.CREEM_API_KEY.startsWith('creem_test_') ? 'test' : 'prod'
	});
}

export async function createCheckoutSession(
	env: Env,
	input: {
		productId: string;
		successUrl: string;
		email: string;
		requestId: string;
		metadata: { organizationId: string; userId: string };
	}
) {
	const checkout = await client(env).checkouts.create({
		productId: input.productId,
		successUrl: input.successUrl,
		requestId: input.requestId,
		customer: { email: input.email },
		metadata: input.metadata
	});

	if (!checkout.checkoutUrl) {
		throw new AppError('internal', 'Creem returned a checkout with no URL');
	}
	return { id: checkout.id, url: checkout.checkoutUrl };
}

export async function createPortalSession(env: Env, creemCustomerId: string) {
	const links = await client(env).customers.generateBillingLinks({
		customerId: creemCustomerId
	});
	return links.customerPortalLink;
}

export async function cancelCreemSubscription(
	env: Env,
	creemSubscriptionId: string,
	mode: 'immediate' | 'scheduled'
) {
	await client(env).subscriptions.cancel(creemSubscriptionId, { mode, onExecute: 'cancel' });
}

export async function fetchCreemSubscription(
	env: Env,
	creemSubscriptionId: string
): Promise<Omit<SubscriptionSnapshot, 'organizationId'>> {
	const s = await client(env).subscriptions.get(creemSubscriptionId);
	return {
		creemSubscriptionId: s.id,
		creemCustomerId: typeof s.customer === 'string' ? s.customer : s.customer.id,
		creemProductId: typeof s.product === 'string' ? s.product : s.product.id,
		status: s.status,
		currentPeriodEnd: s.currentPeriodEndDate ?? null
	};
}

export type VerifiedEvent = {
	id: string;
	type: string;
	createdAt: number;
	data: unknown;
};

export async function verifyAndParseWebhook(
	rawBody: string,
	headers: Headers,
	secret: string
): Promise<VerifiedEvent> {
	const event = await constructWebhookEvent(rawBody, headers, { secret });

	if (!event.id) throw new AppError('invalid', 'Creem webhook has no event id');

	return {
		id: event.id,
		type: event.type,
		createdAt: event.createdAt ?? 0,
		data: event.data
	};
}

const ref = z.union([z.string(), z.object({ id: z.string() })]).transform((v) => {
	return typeof v === 'string' ? v : v.id;
});

const subscriptionObject = z.object({
	id: z.string(),
	status: z.string(),
	customer: ref,
	product: ref,
	current_period_end_date: z.iso.datetime().nullish(),
	metadata: z.record(z.string(), z.unknown()).nullish()
});

const orderObject = z.object({
	id: z.string(),
	product: z.string(),
	customer: z.string().nullish(),
	status: z.string().nullish(),
	created_at: z.string().nullish()
});

const checkoutObject = z.object({
	order: orderObject.nullish(),
	subscription: subscriptionObject.nullish(),
	customer: ref.nullish(),
	metadata: z.record(z.string(), z.unknown()).nullish()
});

const refundObject = z.object({
	order: z.union([z.string(), orderObject]).nullish(),
	customer: ref.nullish()
});

export type SubscriptionSnapshot = {
	creemSubscriptionId: string;
	creemCustomerId: string;
	creemProductId: string;
	status: string;
	currentPeriodEnd: Date | null;
	organizationId: string | null;
};

const SUBSCRIPTION_EVENTS = new Set([
	'subscription.active',
	'subscription.paid',
	'subscription.trialing',
	'subscription.update',
	'subscription.paused',
	'subscription.past_due',
	'subscription.canceled',
	'subscription.scheduled_cancel',
	'subscription.expired'
]);

export function subscriptionFromEvent(event: VerifiedEvent): SubscriptionSnapshot | null {
	let object: z.infer<typeof subscriptionObject> | null = null;

	if (event.type === 'checkout.completed') {
		const checkout = checkoutObject.safeParse(event.data);
		object = checkout.success ? (checkout.data.subscription ?? null) : null;
	} else if (SUBSCRIPTION_EVENTS.has(event.type)) {
		const parsed = subscriptionObject.safeParse(event.data);
		object = parsed.success ? parsed.data : null;
	}

	if (!object) return null;

	const organizationId = object.metadata?.organizationId;
	return {
		creemSubscriptionId: object.id,
		creemCustomerId: object.customer,
		creemProductId: object.product,
		status: object.status,
		currentPeriodEnd: object.current_period_end_date
			? new Date(object.current_period_end_date)
			: null,
		organizationId: typeof organizationId === 'string' ? organizationId : null
	};
}

export type PurchaseSnapshot = {
	creemOrderId: string;
	creemCustomerId: string;
	creemProductId: string;
	organizationId: string | null;
	purchasedAt: Date;
	status: 'paid' | 'refunded';
};

function toDate(value: string | null | undefined, fallback: number): Date {
	const date = value ? new Date(value) : null;
	return date && !Number.isNaN(date.getTime()) ? date : new Date(fallback);
}

export function purchaseFromEvent(event: VerifiedEvent): PurchaseSnapshot | null {
	if (event.type === 'checkout.completed') {
		const parsed = checkoutObject.safeParse(event.data);
		if (!parsed.success) return null;
		const order = parsed.data.order;
		if (!order) return null;
		const organizationId = parsed.data.metadata?.organizationId;
		return {
			creemOrderId: order.id,
			creemCustomerId: order.customer ?? parsed.data.customer ?? '',
			creemProductId: order.product,
			organizationId: typeof organizationId === 'string' ? organizationId : null,
			purchasedAt: toDate(order.created_at, event.createdAt),
			status: 'paid'
		};
	}

	if (event.type === 'refund.created') {
		const parsed = refundObject.safeParse(event.data);
		if (!parsed.success) return null;
		const order = parsed.data.order;
		if (!order) return null;
		if (typeof order === 'string') {
			return {
				creemOrderId: order,
				creemCustomerId: parsed.data.customer ?? '',
				creemProductId: '',
				organizationId: null,
				purchasedAt: new Date(event.createdAt),
				status: 'refunded'
			};
		}
		return {
			creemOrderId: order.id,
			creemCustomerId: order.customer ?? parsed.data.customer ?? '',
			creemProductId: order.product,
			organizationId: null,
			purchasedAt: new Date(event.createdAt),
			status: 'refunded'
		};
	}

	return null;
}
