import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { subscription } from '../db/schema';
import { ctx, orgId, seedBillingOrg } from './fixtures';
import { cancelSubscription, openBillingPortal, startCheckout } from './checkout';

let plain: string;
let owner: string;

beforeEach(async () => {
	({ plain, owner } = await seedBillingOrg());
});

describe('authorization', () => {
	it('stops a plain member opening the billing portal', async () => {
		await expect(openBillingPortal(ctx, env, { id: plain }, orgId)).rejects.toMatchObject({
			code: 'forbidden'
		});
	});

	it('stops a plain member canceling the subscription', async () => {
		await expect(cancelSubscription(ctx, env, { id: plain }, orgId, true)).rejects.toMatchObject({
			code: 'forbidden'
		});
	});
});

describe('startCheckout', () => {
	it('refuses a second checkout when the org already has a paid plan', async () => {
		const paidEnv = { ...env, CREEM_PRODUCT_PRO: 'prod_pro' } as Env;
		await ctx.db.insert(subscription).values({
			id: crypto.randomUUID(),
			organizationId: orgId,
			creemCustomerId: 'cust_1',
			creemSubscriptionId: 'sub_current',
			creemProductId: 'prod_pro',
			status: 'active',
			currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			lastEventAt: new Date()
		});

		await expect(
			startCheckout(ctx, paidEnv, { id: owner }, orgId, {
				productId: 'prod_pro',
				successUrl: 'https://app.test/app/billing?checkout=success',
				analytics: false
			})
		).rejects.toMatchObject({ code: 'conflict' });
	});
});
