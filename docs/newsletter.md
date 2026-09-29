# Newsletter

A double opt-in newsletter for anonymous visitors. Someone enters their email on the marketing landing, receives a confirmation email, and is only marked `confirmed` after clicking the link in it. The whole flow is a standard `route adapter -> service -> database` slice, but for a caller with no `Actor` and no organization.

## The flow

1. The prerendered landing renders `$lib/components/newsletter/NewsletterSignup.svelte`. A prerendered page cannot read `env`, so the component fetches `GET /api/newsletter/subscribe` on mount to learn whether Turnstile is configured (`{ turnstileSiteKey }`), then renders the widget only when a site key is present. The form submits by client `fetch`, not a form action.
2. `POST /api/newsletter/subscribe` is a thin adapter: it builds a `Ctx` with `createCtx(platform)`, reads `cf-connecting-ip`, passes `url.origin`, calls the service, converts errors with `httpError(e)`, and **always** returns `202 { ok: true }` on the success path.
3. `subscribe(ctx, env, origin, ip, input, captchaToken)` in `$lib/server/newsletter/service.ts` validates the email, verifies Turnstile (opt-in), rate-limits per IP, upserts a `pending` subscriber with a fresh hashed confirm token, and enqueues the confirmation email through `ctx.waitUntil`.
4. The link lands on `src/routes/newsletter/confirm/`, a non-prerendered route whose `load` calls `confirm(ctx, token)`. `+page.svelte` renders a generic confirmed / invalid-or-expired state behind `<Seo noindex />`.

## The table

`newsletter_subscriber` (`$lib/server/db/schema.ts`), keyed on a `unique` email:

- `status` - `pending` (awaiting confirmation), `confirmed` (double opt-in complete), or `unsubscribed` (a future unsubscribe link flips to this rather than deleting the row, keeping an audit trail).
- `confirm_token_hash` - the SHA-256 hex of the emailed token, never the raw token. Indexed for an O(1) confirm lookup. Cleared logic aside, the row keys the resend upsert on the unique email so casing variants collapse to one subscriber (the validation schema lowercases and trims first).
- `confirm_token_expires_at` - a 24h window; an expired token is rejected.
- `confirmed_at` / `unsubscribed_at` - audit timestamps distinct from `updated_at`.

The validation schema is derived from the table with `drizzle-zod` (`createInsertSchema(...).pick({ email: true })`), beside the service, so it cannot drift from the column.

## Non-enumeration

The subscribe endpoint must never reveal whether an address already has a subscription - the same as magic-link and password-reset. The service branches internally (an already-`confirmed` address gets no second email, a `pending` address gets a fresh token), but the endpoint returns an identical `202 { ok: true }` for a new, pending, confirmed, or unknown address. Only a format-invalid email (`400`), a failed captcha (`400`), and rate limiting (`429`) differ, and none of those disclose existence. The confirm route is the same: an invalid or expired token renders the generic invalid state without saying whether any address exists.

The UI copy matches: `newsletter_success` is unconditional ("check your inbox"), shown for every accepted submit.

## Turnstile (opt-in)

Captcha is opt-in and follows the template's both-or-neither contract:

- `TURNSTILE_SECRET_KEY` (secret) enables **server-side** enforcement. `verifyTurnstile(env, token, ip)` in `$lib/server/turnstile.ts` is a no-op when the secret is unset, so the feature works with neither key set. The better-auth captcha plugin only guards better-auth routes, so this endpoint calls `verifyTurnstile` itself, before the rate limit and any DB work.
- `TURNSTILE_SITE_KEY` (public) only renders the widget. The component learns it from the `GET` config endpoint and sends the resulting token as `turnstileToken` in the POST body (the marketing form has no auth client and cannot use the `x-captcha-response` header path).

## Rate limiting

The endpoint emails an address the caller chose, so it is rate limited through the `RATE_LIMITER` binding seam, keyed per IP (`newsletter:<ip>`), throwing `AppError('rate_limited')` (429). This is an app endpoint, not an auth route, so it does not use better-auth's `customRules`.

## Email

The confirmation email is templated in `$lib/server/email/templates/newsletter-emails.ts` (`newsletterConfirmEmail`), reusing the shared `buildEmail` and the `email_newsletter_*` Paraglide keys. Subscribers are anonymous with no `user.locale`, so it renders in `baseLocale`. The body carries the confirm token - a bearer credential - so it is sent through `ctx.waitUntil` and **never logged**.

## Notes and gotchas

- The confirm link is a `GET` (like magic-link/verify), so an email security scanner that fetches links could auto-confirm. That is acceptable for double opt-in and consistent with the rest of the template; if you want stricter proof of intent, make confirm a `POST` form action behind a button on the confirm page.
- The email link must be absolute, so the service takes `url.origin` from the live `/api` request rather than `SITE.url` - prerendering has no real origin, but the endpoint does.
- `newsletter/confirm` is deliberately **not** in `sitemap.xml`: it is `noindex` and dynamic. The landing page is already listed.
- New table means the truncate list in `tests/isolate-db.ts` includes `newsletter_subscriber` (it has no foreign key, so `CASCADE` will not reach it), and a committed migration was generated with `bun run db:generate`.
