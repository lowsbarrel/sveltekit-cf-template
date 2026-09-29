import { eq } from 'drizzle-orm';
import { subscription } from '../db/schema';
import { AppError } from '../errors';
import { requirePermission } from '../orgs/service';
import { fetchCreemSubscription } from './creem';
import type { SubscriptionSnapshot } from './creem';
import type { Actor, Ctx } from '../ctx';

export async function syncSubscription(ctx: Ctx, env: Env, actor: Actor, orgId: string) {
	await requirePermission(ctx, actor, orgId, { billing: ['manage'] });

	const [row] = await ctx.db
		.select()
		.from(subscription)
		.where(eq(subscription.organizationId, orgId));
	if (!row) throw new AppError('not_found', 'No subscription for this organization');

	let snapshot: Omit<SubscriptionSnapshot, 'organizationId'>;
	try {
		snapshot = await fetchCreemSubscription(env, row.creemSubscriptionId);
	} catch (e) {
		console.warn({ event: 'billing.resync_failed', orgId, error: String(e) });
		throw new AppError('internal', 'Could not reach Creem to resync the subscription');
	}

	const values = {
		creemCustomerId: snapshot.creemCustomerId,
		creemSubscriptionId: snapshot.creemSubscriptionId,
		creemProductId: snapshot.creemProductId,
		status: snapshot.status,
		currentPeriodEnd: snapshot.currentPeriodEnd,
		lastEventAt: new Date()
	};
	await ctx.db
		.insert(subscription)
		.values({ id: crypto.randomUUID(), organizationId: orgId, ...values })
		.onConflictDoUpdate({ target: subscription.organizationId, set: values });

	console.log({ event: 'billing.resynced', orgId, status: snapshot.status });
	return { status: snapshot.status };
}
