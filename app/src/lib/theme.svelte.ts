export type Theme = 'light' | 'dark' | 'system';

function readCookie(): Theme {
	if (typeof document === 'undefined') return 'system';
	const m = document.cookie.match(/(?:^|;\s*)theme=(light|dark|system)/);
	return (m?.[1] as Theme) ?? 'system';
}

function prefersDark(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(mode: Theme) {
	if (typeof document === 'undefined') return;
	const dark = mode === 'dark' || (mode === 'system' && prefersDark());
	document.documentElement.classList.toggle('dark', dark);
}

let current = $state<Theme>(readCookie());

export function getTheme(): Theme {
	return current;
}

export function setTheme(next: Theme) {
	current = next;
	document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
	apply(next);
}

export function watchSystemTheme() {
	$effect(() => {
		if (current !== 'system') return;
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => apply('system');
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});
}
