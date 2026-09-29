import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import { getInvitationPreview } from '$lib/server/orgs/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	try {
		const invitation = await getInvitationPreview(createCtx(platform), params.id);
		return {
			invitation,
			viewerEmail: locals.user?.email ?? null
		};
	} catch (e) {
		httpError(e);
	}
};
