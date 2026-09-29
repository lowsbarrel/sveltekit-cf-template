type SseFrame = { id?: string | number; event?: string; data: unknown };

type SseOptions = {
	event: string;
	fields?: Record<string, unknown>;
	onDone?: () => unknown;
};

export function sseResponse(
	pump: (send: (frame: SseFrame) => void, open: () => boolean) => Promise<void>,
	{ event, fields, onDone }: SseOptions
): Response {
	const encoder = new TextEncoder();
	const started = Date.now();
	let cancelled = false;
	let frames = 0;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (frame: SseFrame) => {
				let out = '';
				if (frame.id !== undefined) out += `id: ${frame.id}\n`;
				if (frame.event) out += `event: ${frame.event}\n`;
				controller.enqueue(encoder.encode(`${out}data: ${JSON.stringify(frame.data)}\n\n`));
				frames++;
			};
			console.log({ event: `${event}.open`, ...fields });
			try {
				await pump(send, () => !cancelled);
			} catch {
			} finally {
				// close() throws after cancel; swallowing it keeps onDone reachable.
				try {
					controller.close();
				} catch {}
				console.log({
					event: `${event}.close`,
					...fields,
					frames,
					ms: Date.now() - started,
					cancelled
				});
				await onDone?.();
			}
		},
		cancel() {
			cancelled = true;
		}
	});

	return new Response(stream, {
		headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform' }
	});
}
