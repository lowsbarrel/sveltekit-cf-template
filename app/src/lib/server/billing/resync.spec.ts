import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { ctx, orgId, seedBillingOrg } from './fixtures';
import { syncSubscription } from './resync';

let plain: string;

beforeEach(async () => {
	({ plain } = await seedBillingOrg());
});

describe('authorization', () => {
	it('stops a plain member resyncing the subscription', async () => {
		await expect(syncSubscription(ctx, env, { id: plain }, orgId)).rejects.toMatchObject({
			code: 'forbidden'
		});
	});
});
