import { error, json } from '@sveltejs/kit';
import { avatarUploadTarget, confirmAvatarUpload } from '$lib/server/account/service';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const user = locals.user;
	if (!user) error(401, { message: 'Unauthorized', code: 'unauthorized' });
	const body = (await request.json().catch(() => ({}))) as { contentType?: string; size?: number };
	if (typeof body.contentType !== 'string' || typeof body.size !== 'number') {
		error(400, { message: 'Invalid upload request', code: 'invalid' });
	}
	try {
		const target = await avatarUploadTarget(
			platform!.env,
			{ id: user.id },
			{
				contentType: body.contentType,
				size: body.size
			}
		);
		return json(target);
	} catch (e) {
		httpError(e);
	}
};

export const PUT: RequestHandler = async ({ locals, platform }) => {
	const user = locals.user;
	if (!user) error(401, { message: 'Unauthorized', code: 'unauthorized' });
	const ctx = createCtx(platform);
	try {
		return json(await confirmAvatarUpload(ctx, platform!.env, { id: user.id }));
	} catch (e) {
		httpError(e);
	}
};
