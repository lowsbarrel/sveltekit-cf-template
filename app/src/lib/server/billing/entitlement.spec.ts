import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { FREE_PLAN } from '$lib/plans';
import { ctx, orgId, seedBillingOrg } from './fixtures';
import {
	classifyBillingTransition,
	getBillingOverview,
	isEntitled,
	planForOrg,
	requireActiveSubscription,
	requireWithinLimit
} from './entitlement';

let owner: string;
let plain: string;

beforeEach(async () => {
	({ owner, plain } = await seedBillingOrg());
});

describe('entitlement', () => {
	it('grants on paid-for statuses and denies the rest', () => {
		for (const status of ['active', 'trialing', 'scheduled_cancel', 'paused']) {
			expect(isEntitled({ status })).toBe(true);
		}
		for (const status of ['past_due', 'expired', 'canceled', 'unpaid']) {
			expect(isEntitled({ status })).toBe(false);
		}
		expect(isEntitled(null)).toBe(false);
	});

	it('cuts access once an entitled period has passed (missed terminal webhook)', () => {
		const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
		const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
		expect(isEntitled({ status: 'scheduled_cancel', currentPeriodEnd: past })).toBe(false);
		expect(isEntitled({ status: 'scheduled_cancel', currentPeriodEnd: future })).toBe(true);
	});

	it('refuses an org with no subscription', async () => {
		await expect(requireActiveSubscription(ctx, orgId)).rejects.toMatchObject({
			code: 'forbidden'
		});
	});
});

describe('authorization', () => {
	it('lets any member read the plan but only admins manage it', async () => {
		const asOwner = await getBillingOverview(ctx, env, { id: owner }, orgId);
		expect(asOwner.canManage).toBe(true);

		const asMember = await getBillingOverview(ctx, env, { id: plain }, orgId);
		expect(asMember.canManage).toBe(false);
	});

	it('is free until subscribed, and enforces the free plan quota', async () => {
		expect(await planForOrg(ctx, env, orgId)).toBe(FREE_PLAN);

		await requireWithinLimit(ctx, env, orgId, 'maxTodos', FREE_PLAN.limits.maxTodos! - 1);
		await expect(
			requireWithinLimit(ctx, env, orgId, 'maxTodos', FREE_PLAN.limits.maxTodos!)
		).rejects.toMatchObject({ code: 'limit_reached' });
	});
});

describe('classifyBillingTransition', () => {
	const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
	const later = new Date(future.getTime() + 30 * 24 * 60 * 60 * 1000);

	it('maps entitlement changes to lifecycle transitions', () => {
		expect(classifyBillingTransition(null, { status: 'active', currentPeriodEnd: future })).toBe(
			'active'
		);
		expect(
			classifyBillingTransition(
				{ status: 'canceled' },
				{ status: 'active', currentPeriodEnd: future }
			)
		).toBe('active');
		expect(
			classifyBillingTransition(
				{ status: 'active', currentPeriodEnd: future },
				{ status: 'active', currentPeriodEnd: later }
			)
		).toBe('renewed');
		expect(
			classifyBillingTransition(
				{ status: 'active', currentPeriodEnd: future },
				{ status: 'active', currentPeriodEnd: future }
			)
		).toBeNull();
		expect(
			classifyBillingTransition(
				{ status: 'active', currentPeriodEnd: future },
				{ status: 'canceled' }
			)
		).toBe('canceled');
		expect(
			classifyBillingTransition(
				{ status: 'active', currentPeriodEnd: future },
				{ status: 'past_due' }
			)
		).toBe('payment_failed');
		expect(classifyBillingTransition({ status: 'past_due' }, { status: 'past_due' })).toBeNull();
		expect(classifyBillingTransition(null, { status: 'canceled' })).toBeNull();
	});
});
