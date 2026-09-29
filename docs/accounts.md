# Accounts, team & onboarding

The signed-in surface on top of [auth.md](auth.md) and [multi-tenancy.md](multi-tenancy.md): a settings area, avatars, team invites, an org switcher, and a first-run onboarding wizard. Auth mutations go through better-auth; only avatar presigning, onboarding, and the session/org reads are new services.

## The app shell

Every page under `app/` sits in a `(main)` route group whose layout renders the nav shell (dashboard, notes, team, billing), the account menu (avatar → settings, sign out), and the org switcher. `/app/onboarding` and the notification/realtime endpoints live **outside** the group, so the onboarding gate can redirect into it without the shell's own load fighting the redirect.

The group's `+layout.server.ts` does one membership read (`listUserOrgs`) that serves three jobs: the switcher list, the active org's name/role for the header, and **stale-active-org repair** (below).

### Active-org repair

`session.activeOrganizationId` is an optimistic hint. If it points at an org you're no longer in - e.g. an admin removed you while it was your active org - the shell re-points the session to an org you _do_ belong to and reloads, instead of throwing `forbidden` on every route. Without this, being removed from your active org would lock you out of the whole app, including the switcher and sign-out that would let you recover.

## Settings (`/app/settings`)

A tabbed area; each tab is a thin route adapter over a better-auth endpoint or a small account service.

- **Profile** - display name and avatar.
- **Account** - change email (re-verified to the current address) and change password. The password form is hidden for Google-only accounts (no credential to change; detected by `hasPasswordCredential`).
- **Security** - two-factor authentication and passkeys (below).
- **Sessions** - lists your live sessions and revokes them. Revocation is a server-side row delete (better-auth resolves the session from the database each request), so no session **token** is ever sent to the browser - the UI acts on a session id. Expired rows are filtered out, and the current session can't revoke itself (use "sign out other sessions").
- **Danger zone** - account deletion (below).

## Two-factor & passkeys

Both are better-auth plugins wired in `auth.ts`, managed from Settings → Security.

- **2FA (TOTP)** - the `twoFactor` plugin. Enabling requires the account password (so it's offered only to password accounts), returns a TOTP secret + one-time backup codes, and is confirmed by entering a code. At sign-in, `signIn.email` then returns a `twoFactorRedirect` instead of a session; the login page sends the user to `/2fa` to enter a TOTP or backup code. The verify endpoints are rate limited, and the plugin has its own failed-attempt lockout.
- **Passkeys** - the `@better-auth/passkey` plugin (WebAuthn). Register one from Settings → Security (the browser's biometric/PIN prompt); the login page has a "Sign in with a passkey" button. Passkeys work for any account, including Google-only ones with no password, and are the recommended second factor there. The passkey list/delete is a server read + delete scoped to the owner, like sessions.

## Avatars

`user.image` holds the avatar. It comes from Google on OAuth sign-in, or from an upload; with neither, the `Avatar` component renders deterministic initials.

Uploads use the presigned-R2 pattern (`$lib/server/storage`) in three steps: the browser `POST`s its file's type and size to `/app/settings/avatar`; the service validates them against the policy (`assertUploadWithin`) and returns a presigned `PUT` URL scoped to `avatars/<userId>` with the **content type signed into it**; the browser uploads the bytes **straight to R2**; then a `PUT` confirm step (`confirmAvatarUpload`) `HEAD`s the stored object, re-checks size/type, sets `user.image` **server-side** only if it passes, and deletes the object otherwise. Bytes never pass through the Worker, and the client never chooses the stored URL. Constraints (2 MB, PNG/JPG/WebP) live in `$lib/avatar.ts` and are enforced **server-side** at both the presign and confirm steps (the client pre-check is only for fast feedback); R2 rejects a mismatched `Content-Type` at the edge, and the `HEAD` backstop is the authoritative size gate, since a presigned `PUT` cannot enforce a max-size range ([cloudflare.md](cloudflare.md)).

**Setup.** Upload is gated on `storageConfigured(env)` and degrades to Google photo / initials until you provide the R2 secrets plus `R2_PUBLIC_URL` (a bucket custom domain or the r2.dev URL). The bucket also needs a **CORS policy** allowing `PUT`/`GET` from your app origin, or the browser preflight fails. See the R2 block in `wrangler.jsonc`.

Two hardening notes. The signed `Content-Type` binds the _declared_ header, not the actual bytes (nothing sniffs magic bytes), so serve `R2_PUBLIC_URL` with `X-Content-Type-Options: nosniff` and keep it a **separate origin** from the app, so a mislabeled object can never be sniff-executed in the app's security context (SVG is already excluded from `AVATAR_TYPES`). And `confirmAvatarUpload` writes `user.image` directly via Drizzle (like `completeOnboarding`); this is correct only while `session.cookieCache` stays disabled (its default) - if you enable it, `getSession` serves the cached user and the new avatar lags until the cache expires, so bust the session cache after any direct `user` write.

## Team & invites

`/app/team` reads the roster (`listTeam` - any member may view) and drives mutations through better-auth's organization client: invite by email, change roles (member/admin), remove members, revoke pending invites, and leave. Authorization is the org plugin's, using the same `$lib/permissions.ts` vocabulary; the UI hides controls a role can't use, but that's courtesy - the server enforces it.

Invitations email the invitee via the `sendInvitationEmail` hook wired in `auth.ts` (rate limited like the other caller-addressed mails). The link lands on **`/accept-invitation/[id]`**, a public page that works signed-out: it shows who invited you to which org, and either prompts sign-in (carrying the accept URL through `?next=`, see below) or offers accept/reject. Accepting sets the joined org active and drops you in the app.

Leaving your active org, or being removed from it, is handled by active-org repair above.

### `?next=` redirect

`/login` and `/signup` honour a `?next=<path>` param so an invite link survives sign-in. `safeNext` (`$lib/utils/redirect.ts`) accepts only same-origin paths - it resolves the value against an opaque origin and rejects anything that escapes it (absolute URLs, `//host`, and the browser-folded `/\host` / tab tricks), so the param can't become an open redirect.

## Onboarding

First-run wizard at `/app/onboarding`: name your workspace, set profile + avatar, invite teammates, choose a plan. It's gated by `user.onboardedAt` (a server-only field - the `(main)` layout redirects here while it's null). The final step marks onboarding complete and, if a paid plan was chosen, hands off to Creem checkout; `completeOnboarding` runs first either way so the `/app` gate won't bounce the user back after checkout.

## Account deletion

Deletion is **email-confirmed** (`sendDeleteAccountVerification`): clicking "delete" sends a link, and the account is removed only when the link is opened. This works for every account type regardless of session freshness - without it, a password-less Google user whose session is older than `freshAge` can't delete at all. It's blocked upfront (and again in `beforeDelete`) while the user still owns an organization with a live subscription, so a paid plan isn't orphaned; cancel on the billing portal first. Like password reset, it needs email configured to work.

The `user` row is then hard-deleted and every personal table cascades with it (`session`, `account`, `passkey`, `two_factor`, `notification`, `todo`, `member`); `note.createdBy` is `set null`, so org-owned content survives with authorship pseudonymized. An `afterDelete` hook runs `eraseUserData`, which deletes the user's R2 objects (the avatar) and writes a tombstone to `erasures/<userId>.json` in R2. The tombstone lives outside the database backup boundary so a restore can re-apply the erasure - the right-to-be-forgotten story across backups is in [backups.md](backups.md).
