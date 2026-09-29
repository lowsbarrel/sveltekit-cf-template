import { redirect } from '@sveltejs/kit';
import { safeNext } from '$lib/utils/redirect';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(302, safeNext(url.searchParams.get('next')));
};
