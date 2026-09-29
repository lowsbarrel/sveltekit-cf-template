const BACKOFF_MS = [1000, 2000, 5000, 15_000, 30_000];

type EventStreamOptions = {
	url: () => string;
	onMessage: (data: string) => void;
	onLost: () => void;
};

// EventSource retries a dropped connection but never a non-2xx response.
export function eventStream({ url, onMessage, onLost }: EventStreamOptions) {
	let es: EventSource | null = null;
	let attempt = 0;
	let retry: ReturnType<typeof setTimeout> | null = null;

	function open() {
		retry = null;
		es = new EventSource(url());
		es.onopen = () => (attempt = 0);
		es.onmessage = (e) => onMessage(e.data);
		es.onerror = () => {
			if (es?.readyState !== EventSource.CLOSED) return;
			es = null;
			const delay = BACKOFF_MS[attempt++];
			if (delay === undefined) onLost();
			else retry = setTimeout(open, delay);
		};
	}

	function wake() {
		if (es || retry) return;
		attempt = 0;
		open();
	}

	open();
	addEventListener('online', wake);

	return {
		close() {
			removeEventListener('online', wake);
			if (retry) clearTimeout(retry);
			retry = null;
			es?.close();
			es = null;
		}
	};
}
