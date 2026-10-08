import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { GET } from './+server';
import { createWorkerCtx } from '$lib/server/ctx';
import { notify } from '$lib/server/notifications/service';
import { user } from '$lib/server/db/schema';

const ctx = createWorkerCtx(env);
let userId: string;

beforeEach(async () => {
	const [u] = await ctx.db
		.insert(user)
		.values({ id: crypto.randomUUID(), name: 'Ada', email: 'ada@example.com' })
		.returning();
	userId = u!.id;
});

const event = () =>
	({ locals: { user: { id: userId } }, platform: { env } }) as unknown as Parameters<typeof GET>[0];

type Inbox = { notifications: { id: number }[]; latestId: number };

describe('GET /app/notifications cursor', () => {
	it('resumes the stream from the newest inbox row', async () => {
		const first = await notify(ctx, userId, { bodyKey: 'notif_note_created', params: {} });
		const second = await notify(ctx, userId, { bodyKey: 'notif_note_created', params: {} });

		const body = (await (await GET(event())).json()) as Inbox;

		expect(body.notifications.map((n) => n.id)).toEqual([second!.id, first!.id]);
		expect(body.latestId).toBe(second!.id);
	});

	it('leaves a later refresh row for the stream instead of skipping it', async () => {
		const message = await notify(ctx, userId, { bodyKey: 'notif_note_created', params: {} });
		const refresh = await notify(ctx, userId, {
			kind: 'refresh',
			params: { invalidate: 'app:notes' }
		});

		const body = (await (await GET(event())).json()) as Inbox;

		expect(body.notifications.map((n) => n.id)).toEqual([message!.id]);
		expect(body.latestId).toBeLessThan(refresh!.id);
	});

	it('falls back to the newest id when the inbox is empty', async () => {
		const refresh = await notify(ctx, userId, { kind: 'refresh', params: {} });

		const body = (await (await GET(event())).json()) as Inbox;

		expect(body.notifications).toEqual([]);
		expect(body.latestId).toBe(refresh!.id);
	});
});
