import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { GET } from './+server';
import { createWorkerCtx } from '$lib/server/ctx';
import { notification, user } from '$lib/server/db/schema';

const ctx = createWorkerCtx(env);
let userId: string;

beforeEach(async () => {
	const [u] = await ctx.db
		.insert(user)
		.values({ id: crypto.randomUUID(), name: 'Ada', email: 'ada@example.com' })
		.returning();
	userId = u!.id;
});

async function seed(count: number) {
	const ids: number[] = [];
	for (let i = 0; i < count; i++) {
		const [n] = await ctx.db
			.insert(notification)
			.values({ userId, params: JSON.stringify({ i }) })
			.returning({ id: notification.id });
		ids.push(n!.id);
	}
	return ids;
}

function request(path: string, lastEventId?: string) {
	const url = new URL(`http://x${path}`);
	return {
		locals: { user: { id: userId } },
		platform: { env },
		url,
		request: new Request(url, lastEventId ? { headers: { 'last-event-id': lastEventId } } : {})
	} as unknown as Parameters<typeof GET>[0];
}

async function collect(res: Response, want: number, timeoutMs = 1000) {
	const reader = res.body!.getReader();
	const decoder = new TextDecoder();
	const frames: string[] = [];
	let buffer = '';
	const deadline = Date.now() + timeoutMs;
	try {
		while (frames.length < want && Date.now() < deadline) {
			const next = await Promise.race([
				reader.read(),
				new Promise<{ done: true; value?: undefined }>((resolve) =>
					setTimeout(() => resolve({ done: true }), Math.max(0, deadline - Date.now()))
				)
			]);
			if (next.done || !next.value) break;
			buffer += decoder.decode(next.value, { stream: true });
			let end = buffer.indexOf('\n\n');
			while (end >= 0) {
				frames.push(buffer.slice(0, end));
				buffer = buffer.slice(end + 2);
				end = buffer.indexOf('\n\n');
			}
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
	return frames;
}

const idLines = (frames: string[]) => frames.map((f) => f.split('\n')[0]);

describe('GET /app/notifications/stream cursor', () => {
	it('prefers Last-Event-ID over ?since', async () => {
		const [a, b, c] = await seed(3);

		const frames = await collect(
			await GET(request(`/app/notifications/stream?since=${c}`, String(a))),
			2
		);

		expect(idLines(frames)).toEqual([`id: ${b}`, `id: ${c}`]);
	});

	it('uses ?since when there is no Last-Event-ID', async () => {
		const [, b, c] = await seed(3);

		const frames = await collect(await GET(request(`/app/notifications/stream?since=${b}`)), 1);

		expect(idLines(frames)).toEqual([`id: ${c}`]);
	});

	it('falls back to the newest id when the cursor is not a number', async () => {
		await seed(3);

		const frames = await collect(
			await GET(request('/app/notifications/stream?since=nope')),
			1,
			300
		);

		expect(frames).toEqual([]);
	});

	it('drains a backlog larger than one batch across connections', async () => {
		const ids = await seed(35);

		const first = await collect(await GET(request('/app/notifications/stream?since=0')), 30);
		expect(first).toHaveLength(30);
		const last = first.at(-1)!.split('\n')[0]!.slice(4);

		const rest = await collect(await GET(request(`/app/notifications/stream?since=${last}`)), 5);
		expect(idLines(rest)).toEqual(ids.slice(30).map((id) => `id: ${id}`));
	});
});
