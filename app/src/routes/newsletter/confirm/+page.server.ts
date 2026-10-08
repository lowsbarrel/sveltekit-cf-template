import { createCtx } from '$lib/server/ctx';
import { AppError, httpError } from '$lib/server/errors';
import { confirm } from '$lib/server/newsletter/service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	return { token: url.searchParams.get('token') };
};

export const actions = {
	default: async ({ request, platform }) => {
		const token = (await request.formData()).get('token');
		try {
			await confirm(createCtx(platform), typeof token === 'string' ? token : null);
			return { confirmed: true };
		} catch (e) {
			if (e instanceof AppError && e.code === 'invalid') return { confirmed: false };
			httpError(e);
		}
	}
} satisfies Actions;
