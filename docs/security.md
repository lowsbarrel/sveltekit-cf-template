# Security

What's handled, layer by layer - and the places where deleting a line silently deletes a protection.

## Sessions & identity

- **Sessions & passwords** - better-auth: httpOnly session cookies, scrypt password hashing, origin-checked endpoints; secret must be set or boot fails loud. Expired sessions/verifications are purged by the nightly cron.
- **Identity** - password sign-ups must confirm their address before they can sign in; magic-link and Google users are verified by construction. No unverified account reaches the app, or gets billed.
- **Enumeration** - no auth form reveals whether an address has an account. Magic link, password reset, and resend answer identically either way, and better-auth holds a constant-time floor on the resend endpoint so the _timing_ doesn't leak it either.
- **Breached passwords** - sign-up and password change reject any password found in the Have I Been Pwned corpus (k-anonymity - only a hash prefix leaves the Worker). Fails closed, so the check can't be bypassed by taking the API offline. See [auth.md](auth.md#hardening-captcha--breached-passwords).

## Rate limiting (layered)

1. Cloudflare's L7 DDoS protection is always on, for free, before requests reach the Worker.
2. On a custom domain, add a WAF rate-limiting rule (dashboard; one rule included on Free) - floods die at the edge without consuming Worker invocations.
3. In-app: `handleRateLimit` in `hooks.server.ts` throttles **every** SvelteKit-handled request per IP, 100/60s. The `RATE_LIMITER` binding is **enabled by default** - the hook fails _open_ without it, so deleting the binding silently deletes the protection. Provider webhooks are exempt: they are HMAC-authenticated and idempotent, and throttling them would throttle the provider into its own retry storm and lose payment events.
4. `/api/auth/*` gets precise, Postgres-counted limits from better-auth - database-backed because in-memory counters are per-isolate and useless at the edge. The endpoints that mail an address the _caller_ chose - magic link, sign-up, password reset, verification resend (**3/minute per IP**), plus org invites and email changes - are throttled in `rateLimit.customRules`; at the default they are a spam cannon pointed at strangers.

5. **Bot protection (opt-in):** Cloudflare Turnstile guards sign-up / sign-in / password-reset when `TURNSTILE_SECRET_KEY` is configured - a challenge on the endpoints strangers hit, on top of the IP limits above ([auth.md](auth.md#hardening-captcha--breached-passwords)).

Business quotas ("5 reports/day on Pro") are none of these - they're service logic against DB counts, enforced like any other authorization rule.

## Application

- **Authorization** - in services, never routes: Actor scoping, DB-loaded org membership, `can()` permission checks. See [auth.md](auth.md).
- **Injection & XSS** - Drizzle parameterizes all SQL; Svelte auto-escapes. The only `{@html}` is for developer-authored, trusted content: JSON-LD in `Seo.svelte` (the payload is escaped) and rendered Markdown blog posts ([blog.md](blog.md)). If you render any untrusted input as HTML, sanitize it first (e.g. dompurify).
- **CSRF** - SvelteKit's built-in origin check on form actions; better-auth's own protection on auth endpoints.
- **Headers** - every response gets `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, a minimal `Permissions-Policy`, and HSTS (asserted in E2E). Headers are set **twice on purpose**: `hooks.server.ts` covers Worker responses, `_headers` (at the app root, `app/_headers` - the adapter copies it into the build output) covers static assets (which never reach hooks) - change one, change the other. A CSP is left to the app: set `kit.csp` in `vite.config.ts` once your script/style sources are known - SvelteKit nonces its own inline scripts.
- **Errors** - internals never reach clients; unexpected 500s return only a correlation id.
- **Erasure** - account deletion hard-deletes the user and cascades every personal table; an `afterDelete` hook removes the user's R2 uploads and writes a tombstone that a backup restore replays, so a right-to-be-forgotten request survives a restore instead of being silently undone ([backups.md](backups.md), [accounts.md](accounts.md#account-deletion)).
- **Email bodies are bearer credentials** - magic-link and reset tokens travel in them. They are never logged; `EMAIL_DEBUG` (which does log them) lives only in `.dev.vars`, which is never deployed.

## Secrets & supply chain

- `.dev.vars` gitignored and never deployed; `wrangler secret put` in production. Secrets are never hardcoded, never committed, never placed in `wrangler.jsonc`.
- `bunfig.toml`: `minimumReleaseAge = 604800` (new releases wait a week before bun will resolve them - the unit is _seconds_, not pnpm's minutes; the Cloudflare toolchain is listed in `minimumReleaseAgeExcludes` because it ships near-daily with exact-pinned binaries, and trusting it is equivalent to trusting the platform). Lifecycle scripts are default-deny; `trustedDependencies` in `package.json` is the explicit allow-list (esbuild, workerd, sharp).
- **Weaker than the pnpm setup this replaced, on purpose - know what you gave up.** Two controls have no bun equivalent and were dropped moving off pnpm: `blockExoticSubdeps` (transitive deps could only come from the registry, no git/tarball) and `trustPolicy: no-downgrade` (reject a dependency whose publisher silently loses provenance). Bun's age gate is also softer - it is bypassed for a version already pinned in `bun.lock` ([oven-sh/bun#30525](https://github.com/oven-sh/bun/issues/30525)). To get the dropped controls back, wire a bun Security Scanner (`[install] security.scanner` in `bunfig.toml`, e.g. Socket) or move installs back to pnpm.
- The bun version is pinned in `packageManager` (`bun@1.4.2`); unlike pnpm-via-corepack there is no integrity hash on the toolchain itself, so CI installs bun through the SHA-pinned `oven-sh/setup-bun` action.
- GitHub Actions pinned to SHAs; Dependabot updates actions and the `bun` ecosystem weekly with a 7-day cooldown.
- Lockfile (`bun.lock`) committed; CI installs with `bun install --frozen-lockfile`.
