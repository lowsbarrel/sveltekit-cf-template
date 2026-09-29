import { redirect } from '@sveltejs/kit';
import { resolveFlags } from '$lib/server/flags/service';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	if (!locals.user) redirect(302, '/login');
	const flags = await resolveFlags({ actor: { id: locals.user.id }, env: platform?.env });
	return { user: locals.user, flags };
};
