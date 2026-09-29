import type { ResolvedPathname } from '$app/types';

export function safeNext(next: string | null | undefined, fallback = '/app'): ResolvedPathname {
	if (!next || !next.startsWith('/')) return fallback as ResolvedPathname;
	try {
		const base = 'http://localhost';
		const url = new URL(next, base);
		if (url.origin !== base) return fallback as ResolvedPathname;
		return (url.pathname + url.search + url.hash) as ResolvedPathname;
	} catch {
		return fallback as ResolvedPathname;
	}
}
