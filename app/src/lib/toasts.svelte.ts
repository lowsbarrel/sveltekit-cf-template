export type ToastTone = 'info' | 'error';
export type Toast = { id: number; text: string; href: string | null; tone: ToastTone };

const DISMISS_MS: Record<ToastTone, number> = { info: 6000, error: 10_000 };

let items = $state<Toast[]>([]);
let nextId = 0;

export const toasts = {
	get items() {
		return items;
	}
};

export function showToast(
	text: string,
	{ href = null, tone = 'info' }: { href?: string | null; tone?: ToastTone } = {}
) {
	const id = ++nextId;
	items = [...items, { id, text, href, tone }];
	setTimeout(() => dismissToast(id), DISMISS_MS[tone]);
	return id;
}

export function showError(text: string) {
	return showToast(text, { tone: 'error' });
}

export function dismissToast(id: number) {
	items = items.filter((t) => t.id !== id);
}
