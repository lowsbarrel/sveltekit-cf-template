import { createCtx } from '$lib/server/ctx';
import { AppError, httpError } from '$lib/server/errors';
import { confirm } from '$lib/server/newsletter/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, platform }) => {
	try {
		await confirm(createCtx(platform), url.searchParams.get('token'));
		return { confirmed: true };
	} catch (e) {
		if (e instanceof AppError && e.code === 'invalid') return { confirmed: false };
		httpError(e);
	}
};
