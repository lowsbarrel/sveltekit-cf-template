import { browser } from '$app/environment';

export type Consent = 'granted' | 'denied';

export const CONSENT_COOKIE = 'sveltekit_cf_template_consent';
export const CONSENT_GRANTED: Consent = 'granted';
const ONE_YEAR = 60 * 60 * 24 * 365;

export function readConsent(): Consent | null {
	if (!browser) return null;
	const match = document.cookie.match(
		new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=(${CONSENT_GRANTED}|denied)`)
	);
	return match ? (match[1] as Consent) : null;
}

export function writeConsent(value: Consent): void {
	if (!browser) return;
	document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax; secure`;
}
