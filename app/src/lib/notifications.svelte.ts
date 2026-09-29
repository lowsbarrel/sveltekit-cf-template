import { invalidate, invalidateAll } from '$app/navigation';
import { eventStream } from '$lib/event-stream';
import { INBOX_LIMIT, type Notif, type NotifBodyKey } from '$lib/notifications';
import * as m from '$lib/paraglide/messages';
import { showError, showToast } from '$lib/toasts.svelte';

// Static property access keeps Paraglide tree-shakeable; an m[key] lookup ships every message.
const BODY: Record<NotifBodyKey, (params: Record<string, unknown>) => string> = {
	notif_note_created: (params) => m.notif_note_created({ title: String(params.title ?? '') })
};

let items = $state<Notif[]>([]);
let stream: ReturnType<typeof eventStream> | null = null;
let cursor: number | null = null;
let generation = 0;

export const notifications = {
	get items() {
		return items;
	},
	get unread() {
		return items.filter((n) => n.kind === 'message' && !n.readAt).length;
	}
};

export function renderNotification(n: Pick<Notif, 'bodyKey' | 'params'>): string {
	if (!n.bodyKey) return '';
	const render = BODY[n.bodyKey];
	const params = n.params ? (JSON.parse(n.params) as Record<string, unknown>) : {};
	return render ? render(params) : n.bodyKey;
}

function handle(n: Notif) {
	cursor = Math.max(cursor ?? 0, n.id);
	if (n.kind === 'refresh') {
		const target = n.params ? (JSON.parse(n.params).invalidate as string | undefined) : undefined;
		if (target) invalidate(target);
		else invalidateAll();
		return;
	}
	items = [n, ...items].slice(0, INBOX_LIMIT);
	showToast(renderNotification(n), { href: n.href });
}

export async function connectNotifications() {
	if (stream) return;
	const mine = ++generation;

	let failed = false;
	try {
		const res = await fetch('/app/notifications');
		if (!res.ok) throw new Error(String(res.status));
		const data = (await res.json()) as { notifications: Notif[]; latestId: number };
		items = data.notifications;
		cursor = data.latestId ?? null;
	} catch {
		failed = true;
	}

	if (mine !== generation) return;
	if (failed) showError(m.error_generic());

	// No cursor means the server picks up from the newest id; ?since=0 would replay everything.
	stream = eventStream({
		url: () => `/app/notifications/stream${cursor === null ? '' : `?since=${cursor}`}`,
		onMessage: (data) => {
			try {
				handle(JSON.parse(data) as Notif);
			} catch {}
		},
		onLost: () => showError(m.notifications_offline())
	});
}

export function disconnectNotifications() {
	generation++;
	stream?.close();
	stream = null;
	items = [];
	cursor = null;
}

function setReadAt(ids: number[], readAt: string | null) {
	const target = new Set(ids);
	items = items.map((n) => (target.has(n.id) ? { ...n, readAt } : n));
}

async function postRead(body: { id: number } | { all: true }) {
	try {
		const res = await fetch('/app/notifications', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		return res.ok;
	} catch {
		return false;
	}
}

export async function markRead(id: number) {
	const before = items.find((n) => n.id === id)?.readAt ?? null;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient timestamp, not reactive state
	setReadAt([id], new Date().toISOString());
	if (await postRead({ id })) return;
	setReadAt([id], before);
	showError(m.error_generic());
}

export async function markAllRead() {
	const flipped = items.filter((n) => !n.readAt).map((n) => n.id);
	if (!flipped.length) return;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient timestamp, not reactive state
	setReadAt(flipped, new Date().toISOString());
	if (await postRead({ all: true })) return;
	setReadAt(flipped, null);
	showError(m.error_generic());
}
