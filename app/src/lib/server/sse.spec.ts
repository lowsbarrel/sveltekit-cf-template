import { afterEach, describe, expect, it, vi } from 'vitest';
import { sseResponse } from './sse';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const quiet = () => vi.spyOn(console, 'log').mockImplementation(() => {});

afterEach(() => vi.restoreAllMocks());

describe('sseResponse', () => {
	it('frames id, event and JSON data', async () => {
		quiet();
		const res = sseResponse(
			async (send) => {
				send({ id: 7, data: { title: 'hi' } });
				send({ event: 'ping', data: null });
			},
			{ event: 'test.stream' }
		);

		expect(res.headers.get('content-type')).toBe('text/event-stream');
		expect(await res.text()).toBe('id: 7\ndata: {"title":"hi"}\n\nevent: ping\ndata: null\n\n');
	});

	it('runs onDone after the pump finishes', async () => {
		quiet();
		let done = false;
		const res = sseResponse(async (send) => send({ data: 1 }), {
			event: 'test.stream',
			onDone: () => (done = true)
		});

		await res.text();
		expect(done).toBe(true);
	});

	it('closes the pump and still runs onDone when the client disconnects', async () => {
		quiet();
		let done = false;
		let ticks = 0;
		let openAtEnd: boolean | null = null;

		const res = sseResponse(
			async (send, open) => {
				send({ data: 'first' });
				while (open() && ticks < 200) {
					ticks++;
					await sleep(5);
				}
				openAtEnd = open();
			},
			{ event: 'test.stream', onDone: () => (done = true) }
		);

		const reader = res.body!.getReader();
		await reader.read();
		await reader.cancel();

		await vi.waitFor(() => expect(done).toBe(true));
		expect(openAtEnd).toBe(false);
		expect(ticks).toBeLessThan(200);
	});

	it('survives a pump that throws', async () => {
		quiet();
		let done = false;
		const res = sseResponse(
			async (send) => {
				send({ data: 'before' });
				throw new Error('boom');
			},
			{ event: 'test.stream', onDone: () => (done = true) }
		);

		expect(await res.text()).toBe('data: "before"\n\n');
		expect(done).toBe(true);
	});

	it('logs the stream lifecycle with caller fields', async () => {
		const log = quiet();
		const res = sseResponse(async (send) => send({ data: 1 }), {
			event: 'test.stream',
			fields: { userId: 'u1' }
		});
		await res.text();

		expect(log.mock.calls[0]![0]).toMatchObject({ event: 'test.stream.open', userId: 'u1' });
		expect(log.mock.calls[1]![0]).toMatchObject({
			event: 'test.stream.close',
			userId: 'u1',
			frames: 1,
			cancelled: false
		});
	});
});
