import { redirect } from '@sveltejs/kit';
import { ownsEntitledOrg } from '$lib/server/account/service';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const user = locals.user;
	if (!user) redirect(302, '/login');
	try {
		const blocked = await ownsEntitledOrg(createCtx(platform), platform!.env, { id: user.id });
		return { blocked };
	} catch (e) {
		httpError(e);
	}
};
