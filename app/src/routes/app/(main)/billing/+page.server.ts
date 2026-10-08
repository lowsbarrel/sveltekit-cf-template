import { error, redirect } from '@sveltejs/kit';
import { planById } from '$lib/plans';
import { CONSENT_COOKIE, CONSENT_GRANTED } from '$lib/consent';
import { cancelSubscription, openBillingPortal, startCheckout } from '$lib/server/billing/checkout';
import { getBillingOverview } from '$lib/server/billing/entitlement';
import { syncSubscription } from '$lib/server/billing/resync';
import { planProductId } from '$lib/server/billing/plans';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import type { PlanId } from '$lib/plans';
import type { Actions, PageServerLoad } from './$types';

function context(locals: App.Locals) {
	const user = locals.user;
	if (!user) redirect(302, '/login');
	const orgId = locals.session?.activeOrganizationId;
	if (!orgId) error(404, { message: 'No active organization', code: 'not_found' });
	return { actor: { id: user.id }, orgId };
}

export const load: PageServerLoad = async ({ platform, locals, url }) => {
	const { actor, orgId } = context(locals);
	try {
		const overview = await getBillingOverview(createCtx(platform), platform!.env, actor, orgId);
		const configured = overview.availablePlans.length > 0 && !!platform?.env?.CREEM_API_KEY;
		return {
			...overview,
			configured,
			canceled: url.searchParams.get('canceled') === '1',
			resynced: url.searchParams.get('resynced') === '1'
		};
	} catch (e) {
		httpError(e);
	}
};

export const actions: Actions = {
	checkout: async ({ request, platform, locals, url, cookies }) => {
		const { actor, orgId } = context(locals);
		const analytics = cookies.get(CONSENT_COOKIE) === CONSENT_GRANTED;

		const form = await request.formData();
		const planId = String(form.get('plan')) as PlanId;
		const plan = planById(planId);
		if (!plan?.paid) error(400, { message: 'Unknown plan', code: 'invalid' });

		const productId = planProductId(platform!.env, planId);
		if (!productId)
			error(500, { message: `${planId} is not configured for sale`, code: 'internal' });

		let checkoutUrl: string;
		try {
			checkoutUrl = await startCheckout(createCtx(platform), platform!.env, actor, orgId, {
				productId,
				successUrl: `${url.origin}/app/billing?checkout=success`,
				analytics
			});
		} catch (e) {
			httpError(e);
		}
		redirect(303, checkoutUrl);
	},

	portal: async ({ platform, locals }) => {
		const { actor, orgId } = context(locals);
		let portalUrl: string;
		try {
			portalUrl = await openBillingPortal(createCtx(platform), platform!.env, actor, orgId);
		} catch (e) {
			httpError(e);
		}
		redirect(303, portalUrl);
	},

	cancel: async ({ platform, locals, cookies }) => {
		const { actor, orgId } = context(locals);
		const analytics = cookies.get(CONSENT_COOKIE) === CONSENT_GRANTED;
		try {
			await cancelSubscription(createCtx(platform), platform!.env, actor, orgId, analytics);
		} catch (e) {
			httpError(e);
		}
		redirect(303, '/app/billing?canceled=1');
	},

	resync: async ({ platform, locals }) => {
		const { actor, orgId } = context(locals);
		try {
			await syncSubscription(createCtx(platform), platform!.env, actor, orgId);
		} catch (e) {
			httpError(e);
		}
		redirect(303, '/app/billing?resynced=1');
	}
};
