import { building } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { createAuth } from '$lib/server/auth';
import type { Handle, HandleServerError, RequestEvent } from '@sveltejs/kit';

// platform.env is a proxy whose getter throws on prerenderable routes, so optional chaining cannot guard it.
function workerEnv(event: RequestEvent): Env | undefined {
	try {
		const env = event.platform?.env;
		void env?.RATE_LIMITER;
		return env ?? undefined;
	} catch {
		return undefined;
	}
}

const handleAuth: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;

	const { pathname } = event.url;
	if (pathname === '/api/health' || pathname.startsWith('/api/webhooks/')) return resolve(event);

	const env = workerEnv(event);
	if (building || !env) return resolve(event);

	const auth = createAuth(env, event.url.origin, {
		getRequestEvent,
		waitUntil: event.platform?.ctx?.waitUntil?.bind(event.platform.ctx)
	});
	const sessionData = await auth.api.getSession({ headers: event.request.headers });
	if (sessionData) {
		event.locals.user = sessionData.user;
		event.locals.session = sessionData.session;
	}
	return svelteKitHandler({ event, resolve, auth, building });
};

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('strict-transport-security', 'max-age=31536000');
	return response;
};

const handleRateLimit: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const limiter = workerEnv(event)?.RATE_LIMITER;
	if (!limiter) return resolve(event);

	if (event.url.pathname.startsWith('/api/webhooks/')) return resolve(event);

	const key = event.request.headers.get('cf-connecting-ip') ?? 'unknown';
	const { success } = await limiter.limit({ key });
	if (!success) {
		return Response.json(
			{ message: 'Too many requests', code: 'rate_limited' },
			{ status: 429, headers: { 'retry-after': '60' } }
		);
	}
	return resolve(event);
};

export const handle = sequence(handleSecurityHeaders, handleRateLimit, handleAuth, handleParaglide);

export const handleError: HandleServerError = ({ error, status, message }) => {
	if (status === 404) return { message, code: 'not_found' };
	const id = crypto.randomUUID();
	console.error({ event: 'unhandled_error', id }, error);
	return { message: 'Internal error', code: 'internal', id };
};
