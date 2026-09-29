import { redirect } from '@sveltejs/kit';
import { hasPasswordCredential } from '$lib/server/account/service';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const user = locals.user;
	if (!user) redirect(302, '/login');
	try {
		const hasPassword = await hasPasswordCredential(createCtx(platform), { id: user.id });
		return { hasPassword };
	} catch (e) {
		httpError(e);
	}
};
