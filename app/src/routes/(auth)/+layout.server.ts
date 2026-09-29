import { authMethods } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ platform }) => {
	const env = platform?.env;
	if (!env) return { methods: { google: false, email: false }, turnstileSiteKey: null };
	return { methods: authMethods(env), turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null };
};
