# Analytics (PostHog)

Product analytics wired the privacy-first way: PostHog loads **only after the user consents**, nothing tracks until then, and the whole thing disables cleanly when no key is set. Server-side capture is gated the same way: it runs only when the request carries the granted consent cookie, so declining leaves the server silent too.

## What's wired

- **Consent alert** - `$lib/components/ConsentBanner.svelte`, rendered from the root layout so it appears everywhere (including the prerendered marketing pages). It shows **only when PostHog is configured** and consent is undecided; Accept loads PostHog, Decline stores the choice and loads nothing. The choice lives in a first-party `sveltekit_cf_template_consent` cookie (`$lib/consent.ts`).
- **Client** - `$lib/analytics.ts`. `posthog-js` is **dynamically imported** by `initAnalytics()`, so there is no script, no network call, and no cookie until consent is granted. `identifyUser` ties events to the signed-in user (called from `app/+layout.svelte`); `resetAnalytics` clears identity on sign-out; `captureEvent` sends custom events.
- **Server** - `$lib/server/analytics/service.ts`'s `captureServer(env, …)` posts first- party events straight to PostHog's capture API. It's wired into `startCheckout` (`checkout_started`) and `cancelSubscription` (`subscription_canceled`) through `captureServerIfConsented`, which skips the capture unless the route adapter passes the consent boolean it reads from the `$lib/consent.ts` cookie - `granted` only, undecided and declined both skip capture. `ctx.waitUntil` keeps it off the request path. Add more the same way (signup, `subscription.paid`, …).

Everything is a no-op when `PUBLIC_POSTHOG_KEY` is unset - the app, the banner, and the server capture all stand down, so the template runs with zero analytics out of the box.

## Configure

The **ingestion key is not a secret** (it's write-only), so it's a var, not a `wrangler secret`. Two places read it because the split stack has two runtimes:

- **Client** reads `PUBLIC_POSTHOG_KEY` / `PUBLIC_POSTHOG_HOST` via `$env/dynamic/public` - set them at build/deploy time. For local dev, put them in a `.env` file (SvelteKit reads `PUBLIC_`-prefixed vars there; this is **not** `.dev.vars`).
- **Server** reads the same names from `platform.env` - uncomment them in the `wrangler.jsonc` `vars` block.

```sh
# .env  (local client dev)
PUBLIC_POSTHOG_KEY=phc_xxx
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # or https://eu.i.posthog.com
```

Grab the project key from PostHog → Project settings. That's it - the banner appears, and accepting it starts capture.

## Recommended: reverse-proxy to dodge ad-blockers

Analytics requests to `*.i.posthog.com` are commonly blocked. In production, proxy them through your own domain. Add a catch-all route and point the client at it:

```ts
// src/routes/ingest/[...path]/+server.ts
import { env } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

const handler: RequestHandler = async ({ request, params, url }) => {
	const host = params.path.startsWith('static/')
		? 'https://us-assets.i.posthog.com' // static assets live on a separate host
		: env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
	const headers = new Headers(request.headers);
	headers.set('host', new URL(host).host);
	const res = await fetch(`${host}/${params.path}${url.search}`, {
		method: request.method,
		headers,
		body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
		// @ts-expect-error - duplex is required when streaming a request body on Workers
		duplex: 'half'
	});
	return new Response(res.body, { status: res.status, headers: res.headers });
};

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
```

Then set `api_host: '/ingest'` (and `ui_host: HOST`) in `initAnalytics` (`$lib/analytics.ts`). Verify the route isn't caught by the rate-limit hook in a way that throttles ingestion.

## Consent & the cookie policy

The consent banner is the alert; the cookie policy page (`/cookies`) already explains that analytics loads only after consent. If you add other trackers, gate them behind the same consent check (`readConsent()`), and keep the policy honest.

## Feature flags, A/B tests, session replay

All included in `posthog-js` once initialized - call `posthog` features via `captureEvent` or import the client. Enable session replay in the PostHog project settings; it respects the same consent gate because the SDK never loads until the user accepts.
