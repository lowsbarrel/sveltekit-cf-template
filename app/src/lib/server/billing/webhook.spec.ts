import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { purchase, subscription } from '../db/schema';
import { FREE_PLAN } from '$lib/plans';
import { ctx, orgId, seedBillingOrg } from './fixtures';
import { getBillingOverview, planForOrg, requireActiveSubscription } from './entitlement';
import { applyWebhookEvent } from './webhook';
import type { VerifiedEvent } from './creem';

let owner: string;

beforeEach(async () => {
	({ owner } = await seedBillingOrg());
});

function event(over: Partial<VerifiedEvent> & { data?: unknown } = {}): VerifiedEvent {
	return {
		id: over.id ?? crypto.randomUUID(),
		type: over.type ?? 'subscription.paid',
		createdAt: over.createdAt ?? Date.parse('2026-07-14T12:00:00Z'),
		data: over.data ?? {
			id: 'sub_1',
			status: 'active',
			customer: 'cust_1',
			product: 'prod_1',
			current_period_end_date: '2099-08-14T12:00:00.000Z',
			metadata: { organizationId: orgId }
		}
	};
}

describe('webhooks', () => {
	it('applies a subscription and entitles the org', async () => {
		expect(await applyWebhookEvent(ctx, env, event())).toEqual({ status: 'applied' });

		expect(await requireActiveSubscription(ctx, orgId)).toMatchObject({
			status: 'active',
			creemSubscriptionId: 'sub_1',
			creemCustomerId: 'cust_1'
		});
	});

	it('is idempotent: Creem retries the same event id until it gets a 200', async () => {
		const retried = event({ id: 'evt_same' });
		expect(await applyWebhookEvent(ctx, env, retried)).toEqual({ status: 'applied' });
		expect(await applyWebhookEvent(ctx, env, retried)).toEqual({ status: 'duplicate' });

		const rows = await ctx.db.select().from(subscription);
		expect(rows).toHaveLength(1);
	});

	it('does not let a late event resurrect a cancelled plan', async () => {
		await applyWebhookEvent(
			ctx,
			env,
			event({
				id: 'evt_cancel',
				type: 'subscription.canceled',
				createdAt: Date.parse('2026-07-14T12:00:00Z'),
				data: {
					id: 'sub_1',
					status: 'canceled',
					customer: 'cust_1',
					product: 'prod_1',
					metadata: { organizationId: orgId }
				}
			})
		);

		const late = event({ id: 'evt_late', createdAt: Date.parse('2026-07-14T11:00:00Z') });
		expect(await applyWebhookEvent(ctx, env, late)).toEqual({ status: 'stale' });

		await expect(requireActiveSubscription(ctx, orgId)).rejects.toMatchObject({
			code: 'forbidden'
		});
	});

	it('ignores events with nothing to persist rather than making Creem retry', async () => {
		const refund = event({ type: 'refund.created', data: { id: 'ref_1' } });
		expect(await applyWebhookEvent(ctx, env, refund)).toEqual({ status: 'ignored' });
	});

	it('will not guess an owner for a subscription created outside our checkout', async () => {
		const orphan = event({
			data: { id: 'sub_x', status: 'active', customer: 'cust_x', product: 'prod_x' }
		});
		expect(await applyWebhookEvent(ctx, env, orphan)).toEqual({ status: 'unmapped' });
		expect(await ctx.db.select().from(subscription)).toHaveLength(0);
	});

	it('a superseded subscription cannot revoke a live re-subscription', async () => {
		await applyWebhookEvent(ctx, env, event({ id: 'evt_1' }));
		await applyWebhookEvent(
			ctx,
			env,
			event({
				id: 'evt_2',
				createdAt: Date.parse('2026-09-01T12:00:00Z'),
				data: {
					id: 'sub_2',
					status: 'active',
					customer: 'cust_1',
					product: 'prod_1',
					current_period_end_date: '2099-10-01T12:00:00.000Z',
					metadata: { organizationId: orgId }
				}
			})
		);

		const supersededExpiry = event({
			id: 'evt_old_expired',
			type: 'subscription.expired',
			createdAt: Date.parse('2026-10-01T12:00:00Z'),
			data: {
				id: 'sub_1',
				status: 'expired',
				customer: 'cust_1',
				product: 'prod_1',
				metadata: { organizationId: orgId }
			}
		});
		expect(await applyWebhookEvent(ctx, env, supersededExpiry)).toEqual({ status: 'stale' });

		expect(await requireActiveSubscription(ctx, orgId)).toMatchObject({
			creemSubscriptionId: 'sub_2',
			status: 'active'
		});
	});

	it('ignores an entitled event from a superseded subscription older than the current row', async () => {
		await applyWebhookEvent(ctx, env, event({ id: 'evt_1' }));
		await applyWebhookEvent(
			ctx,
			env,
			event({
				id: 'evt_2',
				createdAt: Date.parse('2026-09-01T12:00:00Z'),
				data: {
					id: 'sub_2',
					status: 'active',
					customer: 'cust_1',
					product: 'prod_1',
					current_period_end_date: '2099-10-01T12:00:00.000Z',
					metadata: { organizationId: orgId }
				}
			})
		);

		const retriedOldPaid = event({
			id: 'evt_old_paid',
			createdAt: Date.parse('2026-08-01T12:00:00Z'),
			data: {
				id: 'sub_1',
				status: 'active',
				customer: 'cust_1',
				product: 'prod_1',
				current_period_end_date: '2099-08-01T12:00:00.000Z',
				metadata: { organizationId: orgId }
			}
		});
		expect(await applyWebhookEvent(ctx, env, retriedOldPaid)).toEqual({ status: 'stale' });

		const [row] = await ctx.db.select().from(subscription);
		expect(row!.creemSubscriptionId).toBe('sub_2');
	});

	it('replaces the row when an org re-subscribes after cancelling', async () => {
		await applyWebhookEvent(ctx, env, event({ id: 'evt_1' }));

		await applyWebhookEvent(
			ctx,
			env,
			event({
				id: 'evt_2',
				createdAt: Date.parse('2026-09-01T12:00:00Z'),
				data: {
					id: 'sub_2',
					status: 'active',
					customer: 'cust_1',
					product: 'prod_1',
					current_period_end_date: '2026-10-01T12:00:00.000Z',
					metadata: { organizationId: orgId }
				}
			})
		);

		const rows = await ctx.db.select().from(subscription);
		expect(rows).toHaveLength(1);
		expect(rows[0]!.creemSubscriptionId).toBe('sub_2');
	});

	it('emails only billing managers on an activating transition', async () => {
		const captured: Promise<unknown>[] = [];
		const emailCtx = { ...ctx, waitUntil: (p: Promise<unknown>) => void captured.push(p) };
		const mappedEnv = { ...env, EMAIL: undefined, CREEM_PRODUCT_PRO: 'prod_1' } as Env;
		const logs: Array<Record<string, unknown>> = [];
		const spy = vi.spyOn(console, 'log').mockImplementation((arg) => {
			if (arg && typeof arg === 'object') logs.push(arg as Record<string, unknown>);
		});

		await applyWebhookEvent(emailCtx, mappedEnv, event());
		await Promise.all(captured);
		spy.mockRestore();

		expect(logs.filter((l) => l.event === 'email.skipped')).toHaveLength(1);
	});

	it('flags a non-empty unmapped product, persists the row, and sends no email', async () => {
		const captured: Promise<unknown>[] = [];
		const emailCtx = { ...ctx, waitUntil: (p: Promise<unknown>) => void captured.push(p) };
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

		expect(await applyWebhookEvent(emailCtx, env, event())).toEqual({ status: 'applied' });
		await Promise.all(captured);

		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({ event: 'billing.webhook_unknown_product', productId: 'prod_1' })
		);
		spy.mockRestore();

		expect(captured).toHaveLength(0);
		expect(await ctx.db.select().from(subscription)).toHaveLength(1);
	});
});

describe('purchases (lifetime)', () => {
	const lifeEnv = { ...env, CREEM_PRODUCT_LIFETIME: 'prod_life' } as Env;

	function purchaseEvent(over: Partial<VerifiedEvent> & { data?: unknown } = {}): VerifiedEvent {
		return {
			id: over.id ?? crypto.randomUUID(),
			type: over.type ?? 'checkout.completed',
			createdAt: over.createdAt ?? Date.parse('2026-07-14T12:00:00Z'),
			data:
				over.data ??
				({
					order: {
						id: 'order_1',
						product: 'prod_life',
						customer: 'cust_1',
						status: 'paid',
						created_at: '2026-07-14T12:00:00.000Z'
					},
					metadata: { organizationId: orgId }
				} as unknown)
		};
	}

	it('entitles an org via a one-time purchase with no expiry, beating an expired subscription', async () => {
		await ctx.db.insert(subscription).values({
			id: crypto.randomUUID(),
			organizationId: orgId,
			creemCustomerId: 'cust_1',
			creemSubscriptionId: 'sub_old',
			creemProductId: 'prod_pro',
			status: 'expired',
			currentPeriodEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
			lastEventAt: new Date()
		});

		expect(await applyWebhookEvent(ctx, lifeEnv, purchaseEvent())).toEqual({ status: 'applied' });
		expect((await planForOrg(ctx, lifeEnv, orgId)).id).toBe('lifetime');
	});

	it('never expires: a paid purchase entitles unconditionally', async () => {
		await applyWebhookEvent(ctx, lifeEnv, purchaseEvent());

		const overview = await getBillingOverview(ctx, lifeEnv, { id: owner }, orgId);
		expect(overview.entitled).toBe(true);
		expect(overview.plan.id).toBe('lifetime');
		await expect(requireActiveSubscription(ctx, orgId)).resolves.toBeTruthy();
	});

	it('is idempotent on creem_order_id across distinct events', async () => {
		expect(await applyWebhookEvent(ctx, lifeEnv, purchaseEvent({ id: 'evt_a' }))).toEqual({
			status: 'applied'
		});
		expect(await applyWebhookEvent(ctx, lifeEnv, purchaseEvent({ id: 'evt_b' }))).toEqual({
			status: 'stale'
		});
		expect(await ctx.db.select().from(purchase)).toHaveLength(1);
	});

	it('a refund flips the purchase to refunded and drops entitlement', async () => {
		await applyWebhookEvent(ctx, lifeEnv, purchaseEvent({ id: 'evt_buy' }));
		expect((await planForOrg(ctx, lifeEnv, orgId)).id).toBe('lifetime');

		const refund = purchaseEvent({
			id: 'evt_refund',
			type: 'refund.created',
			data: { order: { id: 'order_1', product: 'prod_life', customer: 'cust_1' } }
		});
		expect(await applyWebhookEvent(ctx, lifeEnv, refund)).toEqual({ status: 'applied' });

		expect(await planForOrg(ctx, lifeEnv, orgId)).toBe(FREE_PLAN);
		const [row] = await ctx.db.select().from(purchase);
		expect(row!.status).toBe('refunded');
	});

	it('flags an unknown one-time product, persists the row, and sends no email', async () => {
		const captured: Promise<unknown>[] = [];
		const emailCtx = { ...ctx, waitUntil: (p: Promise<unknown>) => void captured.push(p) };
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

		expect(await applyWebhookEvent(emailCtx, env, purchaseEvent())).toEqual({ status: 'applied' });
		await Promise.all(captured);

		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({ event: 'billing.webhook_unknown_product', productId: 'prod_life' })
		);
		spy.mockRestore();
		expect(captured).toHaveLength(0);
		expect(await ctx.db.select().from(purchase)).toHaveLength(1);
	});
});
