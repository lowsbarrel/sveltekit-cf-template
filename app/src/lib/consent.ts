import { browser } from '$app/environment';

export type Consent = 'granted' | 'denied';

const COOKIE = 'sveltekit_cf_template_consent';
const ONE_YEAR = 60 * 60 * 24 * 365;

export function readConsent(): Consent | null {
	if (!browser) return null;
	const match = document.cookie.match(/(?:^|;\s*)sveltekit_cf_template_consent=(granted|denied)/);
	return match ? (match[1] as Consent) : null;
}

export function writeConsent(value: Consent): void {
	if (!browser) return;
	document.cookie = `${COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax; secure`;
}
