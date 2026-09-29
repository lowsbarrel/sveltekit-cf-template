import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { ctx, orgId, seedBillingOrg } from './fixtures';
import { cancelSubscription, openBillingPortal } from './checkout';

let plain: string;

beforeEach(async () => {
	({ plain } = await seedBillingOrg());
});

describe('authorization', () => {
	it('stops a plain member opening the billing portal', async () => {
		await expect(openBillingPortal(ctx, env, { id: plain }, orgId)).rejects.toMatchObject({
			code: 'forbidden'
		});
	});

	it('stops a plain member canceling the subscription', async () => {
		await expect(cancelSubscription(ctx, env, { id: plain }, orgId)).rejects.toMatchObject({
			code: 'forbidden'
		});
	});
});
