import * as m from '$lib/paraglide/messages';
import type { Locale } from '$lib/locale';
import type { Plan } from '$lib/plans';

export function planName(plan: Plan, opts?: { locale?: Locale }): string {
	const o = opts?.locale ? { locale: opts.locale } : undefined;
	if (plan.id === 'pro') return m.plan_pro_name({}, o);
	if (plan.id === 'team') return m.plan_team_name({}, o);
	if (plan.id === 'lifetime') return m.plan_lifetime_name({}, o);
	return m.plan_free_name({}, o);
}

export function planTagline(plan: Plan): string {
	if (plan.id === 'pro') return m.plan_pro_tagline();
	if (plan.id === 'team') return m.plan_team_tagline();
	if (plan.id === 'lifetime') return m.plan_lifetime_tagline();
	return m.plan_free_tagline();
}

export function planPrice(plan: Plan): string {
	if (plan.oneTime && plan.priceOnce !== undefined) {
		return m.plan_price_once({ amount: plan.priceOnce });
	}
	return plan.priceMonthly === 0
		? m.plan_price_free()
		: m.plan_price_month({ amount: plan.priceMonthly });
}

export function planFeatures(plan: Plan): string[] {
	const features = [
		plan.limits.maxTodos === null
			? m.plan_feature_todos_unlimited()
			: m.plan_feature_todos({ count: plan.limits.maxTodos }),
		plan.limits.maxMembers === null
			? m.plan_feature_members_unlimited()
			: m.plan_feature_members({ count: plan.limits.maxMembers })
	];
	if (plan.trialDays > 0) features.push(m.plan_trial({ days: plan.trialDays }));
	return features;
}
