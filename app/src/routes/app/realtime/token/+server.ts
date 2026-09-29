import { error, json } from '@sveltejs/kit';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import { mintRealtimeToken } from '$lib/server/realtime/service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const user = locals.user;
	if (!user) error(401, { message: 'Unauthorized', code: 'unauthorized' });
	const orgId = locals.session?.activeOrganizationId;
	if (!orgId) error(400, { message: 'No active organization', code: 'invalid' });

	const body = (await request.json().catch(() => null)) as { room?: unknown } | null;
	if (typeof body?.room !== 'string' || !body.room) {
		error(400, { message: 'room is required', code: 'invalid' });
	}

	try {
		const minted = await mintRealtimeToken(
			createCtx(platform),
			platform!.env,
			{ id: user.id },
			orgId,
			body.room
		);
		return json(minted);
	} catch (e) {
		httpError(e);
	}
};
