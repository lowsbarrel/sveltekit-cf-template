import { error } from '@sveltejs/kit';
import { createCtx } from '$lib/server/ctx';
import { latestNotificationId, notificationsSince } from '$lib/server/notifications/service';
import { sseResponse } from '$lib/server/sse';
import type { RequestHandler } from './$types';

const POLL_MS = 2500;
const STREAM_MAX_MS = 5 * 60_000;

export const GET: RequestHandler = async ({ locals, platform, url, request }) => {
	const user = locals.user;
	if (!user) error(401, { message: 'Unauthorized', code: 'unauthorized' });
	const ctx = createCtx(platform);
	const actor = { id: user.id };

	const lastEventId = request.headers.get('last-event-id');
	const sinceParam = url.searchParams.get('since');
	let cursor = lastEventId ? Number(lastEventId) : sinceParam ? Number(sinceParam) : NaN;
	if (Number.isNaN(cursor)) cursor = await latestNotificationId(ctx, actor);

	return sseResponse(
		async (send, open) => {
			for (let elapsed = 0; elapsed < STREAM_MAX_MS && open(); elapsed += POLL_MS) {
				for (const n of await notificationsSince(ctx, actor, cursor)) {
					send({ id: n.id, data: n });
					cursor = n.id;
				}
				await new Promise((r) => setTimeout(r, POLL_MS));
			}
		},
		{ event: 'notifications.stream', fields: { userId: user.id }, onDone: () => ctx.close() }
	);
};
