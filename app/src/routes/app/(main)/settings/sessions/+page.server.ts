import { error, redirect } from '@sveltejs/kit';
import { listUserSessions, revokeOtherSessions, revokeSession } from '$lib/server/account/service';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const user = locals.user;
	if (!user) redirect(302, '/login');
	try {
		const sessions = await listUserSessions(createCtx(platform), { id: user.id });
		return { sessions, currentSessionId: locals.session?.id ?? null };
	} catch (e) {
		httpError(e);
	}
};

export const actions: Actions = {
	revoke: async ({ request, platform, locals }) => {
		const user = locals.user;
		if (!user) redirect(302, '/login');
		const id = String((await request.formData()).get('id'));
		if (id === locals.session?.id) {
			error(400, { message: 'Cannot revoke the current session', code: 'invalid' });
		}
		try {
			await revokeSession(createCtx(platform), { id: user.id }, id);
		} catch (e) {
			httpError(e);
		}
		return { revoked: true };
	},

	revokeOthers: async ({ platform, locals }) => {
		const user = locals.user;
		const current = locals.session?.id;
		if (!user || !current) redirect(302, '/login');
		try {
			await revokeOtherSessions(createCtx(platform), { id: user.id }, current);
		} catch (e) {
			httpError(e);
		}
		return { revoked: true };
	}
};
