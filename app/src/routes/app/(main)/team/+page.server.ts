import { error, redirect } from '@sveltejs/kit';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import { listTeam } from '$lib/server/orgs/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const user = locals.user;
	if (!user) redirect(302, '/login');
	const orgId = locals.session?.activeOrganizationId;
	if (!orgId) error(404, { message: 'No active organization', code: 'not_found' });
	try {
		return await listTeam(createCtx(platform), { id: user.id }, orgId);
	} catch (e) {
		httpError(e);
	}
};
