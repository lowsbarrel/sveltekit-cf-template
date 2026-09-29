export type PlanLimits = {
	maxTodos: number | null;
	maxMembers: number | null;
};

export type Plan = {
	id: string;
	priceMonthly: number;
	priceOnce?: number;
	oneTime?: boolean;
	trialDays: number;
	highlighted: boolean;
	paid: boolean;
	limits: PlanLimits;
};

export const PLANS: Record<'free' | 'pro' | 'team' | 'lifetime', Plan> = {
	free: {
		id: 'free',
		priceMonthly: 0,
		trialDays: 0,
		highlighted: false,
		paid: false,
		limits: { maxTodos: 10, maxMembers: 1 }
	},
	pro: {
		id: 'pro',
		priceMonthly: 20,
		trialDays: 14,
		highlighted: true,
		paid: true,
		limits: { maxTodos: 1000, maxMembers: 10 }
	},
	team: {
		id: 'team',
		priceMonthly: 50,
		trialDays: 0,
		highlighted: false,
		paid: true,
		limits: { maxTodos: null, maxMembers: null }
	},
	lifetime: {
		id: 'lifetime',
		priceMonthly: 0,
		priceOnce: 300,
		oneTime: true,
		trialDays: 0,
		highlighted: false,
		paid: true,
		limits: { maxTodos: null, maxMembers: null }
	}
};

export type PlanId = keyof typeof PLANS;

export const FREE_PLAN: Plan = PLANS.free;

export const PLAN_LIST: Plan[] = Object.values(PLANS);

const PLAN_RANK = new Map(PLAN_LIST.map((p, i) => [p.id, i]));

export function planById(id: string): Plan | undefined {
	return Object.hasOwn(PLANS, id) ? PLANS[id as PlanId] : undefined;
}

export function planRank(plan: Plan): number {
	return PLAN_RANK.get(plan.id) ?? -1;
}

export function bestPlan(plans: Plan[]): Plan {
	return plans.reduce((best, p) => (planRank(p) > planRank(best) ? p : best), FREE_PLAN);
}
