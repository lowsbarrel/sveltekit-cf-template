import { redirect } from '@sveltejs/kit';
import {
	deletePasskey,
	hasPasswordCredential,
	listUserPasskeys
} from '$lib/server/account/service';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const user = locals.user;
	if (!user) redirect(302, '/login');
	const ctx = createCtx(platform);
	const actor = { id: user.id };
	try {
		const [hasPassword, passkeys] = await Promise.all([
			hasPasswordCredential(ctx, actor),
			listUserPasskeys(ctx, actor)
		]);
		return { hasPassword, passkeys };
	} catch (e) {
		httpError(e);
	}
};

export const actions: Actions = {
	deletePasskey: async ({ request, platform, locals }) => {
		const user = locals.user;
		if (!user) redirect(302, '/login');
		const id = String((await request.formData()).get('id'));
		try {
			await deletePasskey(createCtx(platform), { id: user.id }, id);
		} catch (e) {
			httpError(e);
		}
		return { deleted: true };
	}
};
