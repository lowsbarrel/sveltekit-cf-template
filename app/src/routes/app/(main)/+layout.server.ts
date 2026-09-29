import { error, redirect } from '@sveltejs/kit';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import { listUserOrgs, setActiveOrganization } from '$lib/server/orgs/service';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ platform, parent, locals, url }) => {
	const { user } = await parent();
	if (!user.onboardedAt) redirect(302, '/app/onboarding');

	const ctx = createCtx(platform);
	try {
		const orgs = await listUserOrgs(ctx, { id: user.id });
		if (!orgs.length) error(404, { message: 'No organization', code: 'not_found' });

		const active = orgs.find((o) => o.id === locals.session?.activeOrganizationId);
		if (!active) {
			const sessionId = locals.session?.id;
			if (sessionId) await setActiveOrganization(ctx, sessionId, orgs[0]!.id);
			redirect(303, url.pathname + url.search);
		}

		return { org: { id: active.id, name: active.name, role: active.role }, orgs };
	} catch (e) {
		httpError(e);
	}
};
