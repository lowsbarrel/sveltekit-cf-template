import { FREE_PLAN, PLAN_LIST, type Plan, type PlanId } from '$lib/plans';

export function planProductId(env: Env, id: PlanId): string | undefined {
	if (id === 'pro') return env.CREEM_PRODUCT_PRO;
	if (id === 'team') return env.CREEM_PRODUCT_TEAM;
	if (id === 'lifetime') return env.CREEM_PRODUCT_LIFETIME;
	return undefined;
}

export function availablePlans(env: Env): Plan[] {
	return PLAN_LIST.filter((p) => p.paid && !!planProductId(env, p.id as PlanId));
}

export function planForProductId(env: Env, productId: string | null | undefined): Plan {
	if (productId) {
		for (const plan of PLAN_LIST) {
			if (plan.paid && planProductId(env, plan.id as PlanId) === productId) return plan;
		}
	}
	return FREE_PLAN;
}
