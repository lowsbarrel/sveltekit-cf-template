import { error, redirect } from '@sveltejs/kit';
import { planById, type PlanId } from '$lib/plans';
import { completeOnboarding, storageConfigured } from '$lib/server/account/service';
import { startCheckout } from '$lib/server/billing/checkout';
import { availablePlans, planProductId } from '$lib/server/billing/plans';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import { orgContext } from '$lib/server/orgs/service';
import type { Actions, PageServerLoad } from './$types';

function context(locals: App.Locals) {
	const user = locals.user;
	if (!user) redirect(302, '/login');
	const orgId = locals.session?.activeOrganizationId;
	if (!orgId) error(404, { message: 'No active organization', code: 'not_found' });
	return { actor: { id: user.id }, orgId, onboardedAt: user.onboardedAt };
}

export const load: PageServerLoad = async ({ platform, locals }) => {
	const { actor, orgId, onboardedAt } = context(locals);
	if (onboardedAt) redirect(302, '/app');
	const env = platform!.env;
	try {
		const org = await orgContext(createCtx(platform), actor, orgId);
		return {
			org,
			uploadEnabled: storageConfigured(env),
			plans: availablePlans(env),
			billingConfigured: !!env.CREEM_API_KEY
		};
	} catch (e) {
		httpError(e);
	}
};

export const actions: Actions = {
	finish: async ({ request, platform, locals, url }) => {
		const { actor, orgId } = context(locals);
		const ctx = createCtx(platform);
		const planId = String((await request.formData()).get('plan') || '');

		let checkoutUrl: string | null = null;
		try {
			await completeOnboarding(ctx, actor);
			const plan = planById(planId);
			if (plan?.paid && platform!.env.CREEM_API_KEY) {
				const productId = planProductId(platform!.env, planId as PlanId);
				if (productId) {
					checkoutUrl = await startCheckout(ctx, platform!.env, actor, orgId, {
						productId,
						successUrl: `${url.origin}/app/billing?checkout=success`
					});
				}
			}
		} catch (e) {
			httpError(e);
		}
		redirect(303, checkoutUrl ?? '/app');
	}
};
