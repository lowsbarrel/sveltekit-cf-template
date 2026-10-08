import type { Ctx } from '../ctx';

type ServerEvent = {
	event: string;
	distinctId: string;
	properties?: Record<string, unknown>;
};

export async function captureServer(env: Env, { event, distinctId, properties }: ServerEvent) {
	const key = env.PUBLIC_POSTHOG_KEY;
	if (!key) return;
	const host = env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
	try {
		await fetch(`${host}/capture/`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				api_key: key,
				event,
				distinct_id: distinctId,
				properties,
				timestamp: new Date().toISOString()
			})
		});
	} catch (e) {
		console.error({ event: 'analytics.capture_failed', name: event }, e);
	}
}

export function captureServerIfConsented(ctx: Ctx, env: Env, consent: boolean, event: ServerEvent) {
	if (!consent) return;
	ctx.waitUntil(captureServer(env, event));
}
