import { json } from '@sveltejs/kit';
import { verifyAndParseWebhook } from '$lib/server/billing/creem';
import { applyWebhookEvent } from '$lib/server/billing/webhook';
import { createCtx } from '$lib/server/ctx';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env?.CREEM_WEBHOOK_SECRET) {
		console.error({ event: 'billing.webhook_unconfigured' });
		return json({ error: 'billing not configured' }, { status: 500 });
	}

	const raw = await request.text();

	let event;
	try {
		event = await verifyAndParseWebhook(raw, request.headers, env.CREEM_WEBHOOK_SECRET);
	} catch (e) {
		console.warn({ event: 'billing.webhook_rejected', reason: (e as Error).message });
		return json({ error: 'invalid webhook' }, { status: 401 });
	}

	const result = await applyWebhookEvent(createCtx(platform), env, event);
	return json({ received: true, ...result });
};
