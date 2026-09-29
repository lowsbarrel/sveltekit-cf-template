import { redirect } from '@sveltejs/kit';
import { safeNext } from '$lib/utils/redirect';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const failed = url.searchParams.get('error');
	if (!failed && locals.user?.emailVerified) redirect(302, safeNext(url.searchParams.get('next')));
	return { failed };
};
