import { error, json } from '@sveltejs/kit';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import {
	latestNotificationId,
	listNotifications,
	markAllRead,
	markRead
} from '$lib/server/notifications/service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const user = locals.user;
	if (!user) error(401, { message: 'Unauthorized', code: 'unauthorized' });
	const ctx = createCtx(platform);
	const actor = { id: user.id };
	try {
		const latestId = await latestNotificationId(ctx, actor);
		const notifications = await listNotifications(ctx, actor);
		return json({ notifications, latestId: notifications[0]?.id ?? latestId });
	} catch (e) {
		httpError(e);
	}
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const user = locals.user;
	if (!user) error(401, { message: 'Unauthorized', code: 'unauthorized' });
	const body = (await request.json().catch(() => ({}))) as { id?: number; all?: boolean };
	const ctx = createCtx(platform);
	const actor = { id: user.id };
	try {
		if (body.all) await markAllRead(ctx, actor);
		else if (typeof body.id === 'number') await markRead(ctx, actor, body.id);
		return json({ ok: true });
	} catch (e) {
		httpError(e);
	}
};
