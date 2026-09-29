import { json } from '@sveltejs/kit';
import { createCtx } from '$lib/server/ctx';
import { httpError } from '$lib/server/errors';
import { subscribe } from '$lib/server/newsletter/service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ platform }) => {
	return json({ turnstileSiteKey: platform?.env?.TURNSTILE_SITE_KEY ?? null });
};

export const POST: RequestHandler = async ({ request, url, platform }) => {
	const env = platform!.env;
	const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';

	let payload: { email?: unknown; turnstileToken?: unknown };
	try {
		payload = await request.json();
	} catch {
		payload = {};
	}

	const captchaToken =
		typeof payload.turnstileToken === 'string' ? payload.turnstileToken : undefined;

	try {
		await subscribe(
			createCtx(platform),
			env,
			url.origin,
			ip,
			{ email: payload.email },
			captchaToken
		);
	} catch (e) {
		httpError(e);
	}

	return json({ ok: true }, { status: 202 });
};
