# Auth, organizations & email

better-auth with a real auth boundary, org-scoped permissions enforced in services, and transactional email that degrades safely when no mail binding exists.

## How identity flows

`hooks.server.ts` resolves the session on every request into `locals.user` / `locals.session` and mounts better-auth's endpoints on `/api/auth/*`. Pages under `app/` sit behind a redirect guard; the auth screens live in the `(auth)` group (`/login`, `/signup`, `/magic-link`, `/verify-email`, `/forgot-password`, `/reset-password`, `/2fa`). Auth tables are part of the Drizzle schema - same migration flow. Secrets: `.dev.vars` locally, `wrangler secret put BETTER_AUTH_SECRET` in production.

## Sign-in methods

Four ship configured, plus TOTP two-factor:

- **Email + password** - scrypt hashes (better-auth default; `N=16384, r=16` ≈ 32 MiB, about the ceiling a 128 MB Workers isolate allows). Reset flow is wired end to end. **Sign-in is blocked until the address is confirmed.**
- **Magic link** - passwordless, 15-minute single-use token. It is also a **sign-up** path, so an unknown address gets an account.
- **Google OAuth** - set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Console → Credentials → OAuth client → Web application). Authorized redirect URI: `https://<your-domain>/api/auth/callback/google`.
- **Passkeys (WebAuthn)** - the `@better-auth/passkey` plugin (`rpID` / `origin` derive from the auth base URL). Users register a passkey from **Settings → Security** and sign in with it from the login screen (`authClient.signIn.passkey()`).
- **Two-factor (TOTP)** - the `twoFactor` plugin, enrolled from **Settings → Security** (authenticator QR + one-time backup codes). Once enabled, password sign-in issues a `/2fa` challenge before the session is granted; the verify endpoints are rate limited (below).

## Footguns, each one deliberate

- **The UI never renders a method the environment can't deliver.** `authMethods(env)` reports what's actually configured and `(auth)/+layout.server.ts` passes it down, so an unconfigured Google button is hidden rather than dead-ending at Google's error page. Drop both env vars and the provider isn't registered at all.
- **Account linking is on, and trusts Google only.** Someone who signed up with a password and later clicks "Continue with Google" lands in the _same_ account instead of creating a duplicate with the same email. This is safe **only** because Google verifies the address itself - never add an unverified provider to `trustedProviders`, or anyone who can register that address elsewhere takes over the account.
- **Endpoints that mail a _caller_-chosen address are rate limited in `rateLimit.customRules`.** Magic link, sign-up, password reset, and verification resend are cut to **3/minute per IP**; organization invites (`/organization/invite-member`, 5/min) and email changes (`/change-email`, 3/min) join them. They mail an address the caller picks, which makes the default 100/10s a spam cannon pointed at strangers. The same block also throttles account deletion and the TOTP / backup-code verify endpoints as brute-force guards - nine custom rules in all.
- **Magic-link and reset responses are deliberately unconditional** ("if that email can receive mail, a link is on its way"). Branching on whether the account exists would turn either form into an account-enumeration oracle.
- **`EMAIL_DEBUG` makes these usable locally.** Without a mail binding, `sendEmail` only logs - and it does _not_ log the body, because the body contains the link, and the link is a bearer credential. Setting `EMAIL_DEBUG=true` in `.dev.vars` logs the body so you can click through. `.dev.vars` is gitignored and never deployed; **never** `wrangler secret put EMAIL_DEBUG`, or anyone who can read production logs can take any account.
- **Email verification is required for password sign-ups, and tied to whether mail can actually leave.** `requireEmailVerification: methods.email` - demanding a confirmation the app cannot deliver would brick every signup, so with no `send_email` binding and no `EMAIL_DEBUG` it turns **off** and logs `auth.email_verification_disabled` at warn. That is the one place a security control here can silently disable itself, which is exactly why it shouts. Magic-link and Google users are unaffected: both prove control of the address by construction and arrive with `emailVerified` already true.
- Confirming auto-signs-in (`autoSignInAfterVerification`), so the emailed link drops the user straight into `/app`. `/verify-email` catches an expired or spent token and offers a resend.

## Hardening: captcha & breached passwords

Two protections layered onto the password endpoints:

- **Cloudflare Turnstile - opt-in.** The `captcha` plugin guards `/sign-up/email`, `/sign-in/email` and `/request-password-reset`, but only when `TURNSTILE_SECRET_KEY` is set, so local dev and tests run without it. Set the **secret** (`wrangler secret put TURNSTILE_SECRET_KEY`, or `.dev.vars` locally) _and_ the public **site key** (`TURNSTILE_SITE_KEY` var in `wrangler.jsonc`) together: the `(auth)` layout passes the site key to the forms, which render `$lib/components/Turnstile.svelte` and send the token as the `x-captcha-response` header. Set the secret without the site key and the server demands a token the client never produces; set the site key without the secret and the widget renders but nothing is enforced. Turnstile is free and Cloudflare-native - no third-party account, and its iframe isn't blocked by the `x-frame-options` header (that only governs framing _of_ your pages).
- **Have I Been Pwned - always on.** The `haveIBeenPwned` plugin rejects any password set on sign-up, password change or password reset (`/sign-up/email`, `/change-password`, `/reset-password`) that appears in a known breach; sign-in is not checked. It uses the Pwned Passwords k-anonymity API, so only a five-character SHA-1 hash prefix leaves the Worker - never the password. It **fails closed**: if `api.pwnedpasswords.com` is unreachable the password operation is rejected rather than silently skipped, so the check can't be bypassed by knocking the API offline. That trades a little availability for a guarantee; it's the one credential check with an external dependency.

## Organizations & permissions

The better-auth [organization plugin](https://www.better-auth.com/docs/plugins/organization) is wired in: `organization` / `member` / `invitation` tables live in the Drizzle schema, and the session carries an `activeOrganizationId`. Signup auto-creates a personal org so a solo user still has one.

- **Vocabulary** - `$lib/permissions.ts` defines the permission statements (better-auth's org resources + your domain resources, e.g. `todo: ['create', 'update', 'delete']`) and the `owner` / `admin` / `member` roles. It's shared by server and client, so UI and services can't disagree about what a role means. Need per-organization runtime roles later? Enable better-auth's dynamic access control addon - the vocabulary file stays the same.
- **Enforcement** - services load membership from the database and check it: `requirePermission(ctx, actor, orgId, { organization: ['update'] })` throws a `forbidden` `AppError` for non-members and under-privileged roles (`$lib/server/orgs/service.ts`, tested in workerd). A role claimed by the client is never trusted.
- **Management** - the browser client handles the lifecycle: `authClient.organization.create({ name, slug })`, `.inviteMember(...)`, `.setActive(...)`, and `checkRolePermission(...)` for static UI-side checks (hide a button - never as real enforcement).

Adding a permission for a new feature is part of the [adding-features.md](adding-features.md) walkthrough.

## Email

Transactional email goes through `$lib/server/email/service.ts`, backed by [Cloudflare Email Service](https://developers.cloudflare.com/email-service/)'s native `send_email` binding (public beta, Workers Paid) - no API keys, no third-party account, `env.EMAIL.send({ from, to, subject, text, html })`. better-auth's password-reset flow is already wired to it.

Without the binding (local dev, tests, accounts without the beta) sending degrades to a structured `email.skipped` log so auth flows never hard-fail offline.

To go live: verify a sender domain in the Cloudflare dashboard, uncomment the `send_email` block in `wrangler.jsonc`, set `EMAIL_FROM` in the vars block, `bun run cf-typegen`. (Sender-domain verification is one of the few steps that cannot be scripted yet - see the manual-steps list in [deploy.md](deploy.md).) `wrangler email sending enable <domain>` adds the SPF + DKIM records to the zone for you. Prefer a **sending subdomain** for `EMAIL_FROM` - e.g. `App <noreply@post.yourdomain.com>` rather than the apex - so mail reputation is isolated from your app domain; it's a deliverability best practice and verifies cleanly.

### Templates & translations

The email **content** is templated and translatable, not inlined. Each email is a function in `$lib/server/email/templates/` that returns `{ subject, text, html }`: `auth-emails.ts` holds the builders - reset, magic-link, verification, organization invitation, email-change confirmation, account-deletion confirmation, and welcome - and `layout.ts` is the shared HTML shell (table layout + inline styles - what email clients actually render; a plain-text version is always included as the fallback). The strings live in the Paraglide catalog under `email_*` keys, like every other user-facing string, so they translate automatically once you add a locale.

The one thing that makes translated email work end to end is **rendering in the recipient's language, not the ambient request locale** - the sender isn't always the recipient, and cron/webhook sends have no request at all. So each message is called with an explicit locale (`m.email_reset_body({}, { locale })`), which also skips `getLocale()` (undefined outside a request). The locale comes from a `user.locale` column captured at signup (from the `PARAGLIDE_LOCALE` cookie, via a better-auth `additionalFields` + `create.before` hook) and read back by `localeFor(email)` in `auth.ts`. English is the only locale today, so it's always `en` - the wiring is there for when you add more, exactly like the rest of the i18n. Unlike the legal pages (a deliberate Paraglide exception), transactional emails belong in the catalog.

To add a new email: write a builder in `templates/`, add its `email_*` strings (`bun run i18n:compile`), and call `sendEmail(env, yourEmail(to, url, await localeFor(to)))`.
