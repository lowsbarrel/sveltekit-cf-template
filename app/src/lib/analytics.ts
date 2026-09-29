import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import type { PostHog } from 'posthog-js';

const KEY = env.PUBLIC_POSTHOG_KEY;
const HOST = env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export const analyticsEnabled = !!KEY;

let client: PostHog | null = null;

export async function initAnalytics(): Promise<void> {
	if (!browser || !KEY || client) return;
	const posthog = (await import('posthog-js')).default;
	posthog.init(KEY, {
		api_host: HOST,
		person_profiles: 'identified_only',
		capture_pageview: true,
		capture_pageleave: true
	});
	client = posthog;
}

export function identifyUser(id: string, email?: string): void {
	client?.identify(id, email ? { email } : undefined);
}

export function resetAnalytics(): void {
	client?.reset();
}

export function captureEvent(event: string, properties?: Record<string, unknown>): void {
	client?.capture(event, properties);
}
