import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	connectNotifications,
	disconnectNotifications,
	markAllRead,
	markRead,
	notifications
} from './notifications.svelte';
import { type Notif } from './notifications';
import * as m from './paraglide/messages';
import { dismissToast, toasts } from './toasts.svelte';

class FakeEventSource {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;
	static instances: FakeEventSource[] = [];

	readyState = FakeEventSource.CONNECTING;
	onopen: (() => void) | null = null;
	onmessage: ((e: { data: string }) => void) | null = null;
	onerror: (() => void) | null = null;

	constructor(readonly url: string) {
		FakeEventSource.instances.push(this);
	}

	close() {
		this.readyState = FakeEventSource.CLOSED;
	}

	open() {
		this.readyState = FakeEventSource.OPEN;
		this.onopen?.();
	}

	send(n: Notif) {
		this.open();
		this.onmessage?.({ data: JSON.stringify(n) });
	}

	failResponse() {
		this.readyState = FakeEventSource.CLOSED;
		this.onerror?.();
	}

	dropConnection() {
		this.readyState = FakeEventSource.CONNECTING;
		this.onerror?.();
	}
}

const last = () => FakeEventSource.instances.at(-1)!;
const errors = () => toasts.items.filter((t) => t.tone === 'error').map((t) => t.text);

function notif(id: number, readAt: string | null = null): Notif {
	return {
		id,
		kind: 'message',
		bodyKey: 'notif_note_created',
		params: JSON.stringify({ title: `note ${id}` }),
		href: null,
		readAt,
		createdAt: '2026-01-01T00:00:00.000Z'
	};
}

let fetchMock: ReturnType<typeof vi.fn>;

async function connect(inbox: Notif[], latestId: number) {
	fetchMock.mockResolvedValueOnce({
		ok: true,
		json: async () => ({ notifications: inbox, latestId })
	});
	await connectNotifications();
}

describe('notifications store', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		FakeEventSource.instances = [];
		fetchMock = vi.fn();
		vi.stubGlobal('EventSource', FakeEventSource);
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		disconnectNotifications();
		for (const t of toasts.items) dismissToast(t.id);
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('opens the stream at the inbox cursor and resumes from the last id after a fatal error', async () => {
		await connect([], 4);
		expect(last().url).toContain('since=4');

		last().send(notif(7));
		last().failResponse();
		await vi.advanceTimersByTimeAsync(1000);

		expect(FakeEventSource.instances).toHaveLength(2);
		expect(last().url).toContain('since=7');
	});

	it('starts without a cursor and warns when the inbox fetch fails', async () => {
		fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
		await connectNotifications();

		expect(last().url).not.toContain('since');
		expect(errors()).toEqual([m.error_generic()]);
	});

	it('opens one stream when connect races itself', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ notifications: [], latestId: 1 })
		});
		await Promise.all([connectNotifications(), connectNotifications()]);

		expect(FakeEventSource.instances).toHaveLength(1);
	});

	it('opens no stream when disconnected mid-connect', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ notifications: [], latestId: 1 })
		});
		const pending = connectNotifications();
		disconnectNotifications();
		await pending;

		expect(FakeEventSource.instances).toHaveLength(0);
	});

	it('drops the previous inbox on disconnect', async () => {
		await connect([notif(1)], 1);
		expect(notifications.items).toHaveLength(1);

		disconnectNotifications();

		expect(notifications.items).toHaveLength(0);
	});

	it('leaves a dropped connection to EventSource itself', async () => {
		await connect([], 0);
		last().dropConnection();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(FakeEventSource.instances).toHaveLength(1);
	});

	it('resets the backoff once a stream opens', async () => {
		await connect([], 0);
		last().failResponse();
		await vi.advanceTimersByTimeAsync(1000);
		last().open();
		last().failResponse();
		await vi.advanceTimersByTimeAsync(1000);
		expect(FakeEventSource.instances).toHaveLength(3);
	});

	it('says so when the retries run out', async () => {
		await connect([], 0);
		for (let i = 0; i < 5; i++) {
			last().failResponse();
			await vi.advanceTimersByTimeAsync(30_000);
		}
		expect(FakeEventSource.instances).toHaveLength(6);
		expect(errors()).toEqual([]);

		last().failResponse();
		expect(errors()).toEqual([m.notifications_offline()]);
	});

	it('keeps a failed mark-read out of the UI and says why', async () => {
		await connect([notif(1)], 1);
		fetchMock.mockResolvedValueOnce({ ok: false });

		await markRead(1);

		expect(notifications.items[0]!.readAt).toBeNull();
		expect(notifications.unread).toBe(1);
		expect(errors()).toEqual([m.error_generic()]);
	});

	it('keeps a successful mark-read', async () => {
		await connect([notif(1)], 1);
		fetchMock.mockResolvedValueOnce({ ok: true });

		await markRead(1);

		expect(notifications.unread).toBe(0);
		expect(errors()).toEqual([]);
	});

	it('reverts only the rows mark-all-read flipped', async () => {
		const read = '2026-01-01T00:00:00.000Z';
		await connect([notif(1), notif(2, read)], 2);

		let respond!: (r: { ok: boolean }) => void;
		fetchMock.mockReturnValueOnce(new Promise((r) => (respond = r)));
		const pending = markAllRead();
		last().send(notif(3));
		respond({ ok: false });
		await pending;

		expect(notifications.items.map((n) => n.id)).toEqual([3, 1, 2]);
		expect(notifications.items.find((n) => n.id === 1)!.readAt).toBeNull();
		expect(notifications.items.find((n) => n.id === 2)!.readAt).toBe(read);
		expect(errors()).toEqual([m.error_generic()]);
	});
});
