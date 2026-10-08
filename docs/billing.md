# Billing (Creem)

Subscriptions live in `$lib/server/billing/`, backed by the official `creem` SDK. **Creem is the Merchant of Record**: it hosts the payment page, owns the card data, and - this is the part that shows up in your legal pages - it is the _seller of record_, so it calculates and remits VAT/sales tax and it eats the chargebacks. Card details never touch this Worker.

## Design decisions

- **Scoped to the organization, not the user.** One `subscription` row per org (unique `organization_id`); every member inherits the entitlement, and only `owner`/`admin` may buy or cancel (`billing: ['read' | 'manage']` in `$lib/permissions.ts`). Signup auto-creates a personal org so a solo user can still pay.
- **One live paid plan per org.** `startCheckout` calls `planForOrg` and refuses with `conflict` when the org is already entitled (a live subscription or a lifetime purchase), so a direct POST to the checkout action cannot start a second billing relationship - the hidden button was never the guard.
- **Why not `@creem_io/better-auth`?** The official plugin is genuinely cleaner - but it resolves every subscription from `session.user.id`, so billing would be _per user_, and its `cancel-subscription` / `create-portal` endpoints carry no role check. This template bills per organization, so it uses the SDK directly and keeps authorization in the service, per the AGENTS.md invariant.
- **Entitlement is derived in the service.** Creem's status vocabulary (`active`, `trialing`, `paused`, `past_due`, `expired`, `canceled`, `scheduled_cancel`) is stored verbatim on the `subscription` row; don't scatter status strings through the app.

## Webhooks

`POST /api/webhooks/creem`. The HMAC signature is the _only_ authentication; the raw body is verified before anything is parsed. Handling is idempotent (event id claimed in the `webhook_event` table in the same transaction as the write, so a failed write genuinely retries) and rejects stale, out-of-order redeliveries - Creem retries at 30s/1m/5m/1h. Staleness is timestamp-first for every event: once the org row tracks a subscription, any event whose `created_at` is not strictly newer is `stale`, whichever subscription id it names, so a retried `subscription.paid` from a superseded id cannot flip the row back. A non-entitled event for a different (superseded) id is always stale, so an old subscription can never revoke a live re-subscription; a genuinely newer entitled event for a new id still replaces the row. Every `subscription.*` event (and a `checkout.completed` carrying a subscription) stores Creem's status verbatim, and entitlement is derived from that status rather than from which event arrived. Only `subscription.paid` carries a `current_period_end_date` (`subscription.active` has none), so the period end comes from it.

**Missed a webhook?** A dead URL after a domain change, downtime, or a rotated secret can drop an event and leave an org on the wrong plan - with no recovery path if webhooks are the _only_ source of truth. So the billing page has a **Resync from Creem** action (owner/admin): `syncSubscription` fetches the current subscription via the Creem API and overwrites the row. The page also surfaces whether webhook events are actually arriving - the `configured` flag only means the app half is wired, not that the dashboard webhook points at this domain (which silently breaks on a domain change - see [deploy.md](deploy.md#custom-domain-as-code)).

## Lifecycle emails

When a webhook actually changes an org's entitlement, the billing managers (owner/admin, resolved from the database via `can(role, { billing: ['manage'] })` - never a role from the client) get a locale-aware email in each recipient's `user.locale`. The transition is decided by the pure `classifyBillingTransition(prev, next)`: not-entitled to entitled is `active`, entitled to entitled with a later `currentPeriodEnd` is `renewed`, entitled to not-entitled is `canceled`, and a resulting `past_due` status is `payment_failed`. A no-op update (same period end, already `past_due`) returns `null` and sends nothing, so a burst of `subscription.update` redeliveries does not spam anyone; the `webhook_event` id claim already dedupes genuine retries.

Sends fire from `ctx.waitUntil` **after** the transaction commits, so a rolled-back webhook never emails and a send failure never makes Creem retry (which would re-drive entitlement logic). Templates live in `$lib/server/email/templates/billing-emails.ts`.

**Unknown product alert.** If a webhook's product id is non-empty but maps to no configured plan (`planForProductId` falls back to the free plan), the row is still persisted - so **Resync** can repair it - but instead of an email the service logs `console.error({ event: 'billing.webhook_unknown_product', ... })`. That is a config-drift or fraud signal (a `CREEM_PRODUCT_*` var pointing at the wrong product, or a checkout for a product this app does not sell), not a customer-facing event.

## One-time (lifetime) purchases

Subscriptions are not the only way to be entitled. A one-time purchase (a lifetime plan) is a **separate `purchase` table**, org-scoped, with no `currentPeriodEnd` - so it is non-expiring by construction. It is not squeezed onto the `subscription` row: that row is unique per org and its stale/ordering logic (`lastEventAt`, matching `creemSubscriptionId`) is subscription-specific, and a one-time order has neither a subscription id nor a renewal, so it cannot live there safely. An org can hold many purchases; idempotency is the unique `creem_order_id` plus the same `webhook_event` id claim as subscriptions.

The webhook path is shared. `applyWebhookEvent` first tries `subscriptionFromEvent`; only when that returns null (a `checkout.completed` carrying an `order` but no `subscription`, or a `refund.created`) does it fall to the purchase branch. A paid order is upserted (`onConflictDoNothing` on `creem_order_id`) and emits the `active` transition; a refund flips the matching row to `refunded` and emits `canceled`. A refunded row stops counting immediately.

**Entitlement is the best of both.** `isEntitled(subscriptionRow)` is unchanged - it still governs the recurring path, grace window included. Lifetime correctness lives in `planForOrg`, which loads the subscription **and** the org's paid purchases in parallel and returns `bestPlan(...)` across the entitled subscription plan and every paid purchase plan (a paid purchase is always entitled - no period check). `bestPlan`/`planRank` order by `PLAN_LIST` index (`$lib/plans.ts`), so a lifetime purchase is never downgraded by a co-existing free or expired subscription. `getBillingOverview` and `requireActiveSubscription` honor a paid purchase the same way. A lifetime buyer gets `billingLifetimeEmail` (the `oneTime` marker on the plan selects it) rather than the recurring `active` copy.

## Setup

1. Create one product in the [Creem dashboard](https://creem.io) per paid plan (test mode first).
2. Set a `CREEM_PRODUCT_*` var per paid plan in `wrangler.jsonc` (`CREEM_PRODUCT_PRO`, `CREEM_PRODUCT_TEAM`, `CREEM_PRODUCT_LIFETIME`) - see [plans.md](plans.md).
3. Secrets: `wrangler secret put CREEM_API_KEY` and `wrangler secret put CREEM_WEBHOOK_SECRET`. A `creem_test_*` key auto-selects the test host; a live key selects production - so a mismatch fails instead of charging a real card.
4. Point the webhook at `https://<your-domain>/api/webhooks/creem`.

**Gotcha:** Cloudflare **Bot Fight Mode challenges webhook deliveries and cannot be skipped by a custom rule** - disable it, or use Super Bot Fight Mode with a skip rule.

## Legal pages

`/terms`, `/privacy`, and `/cookies` are written against what this stack actually does - Creem as MoR, Cloudflare (Workers, Hyperdrive, Workers Logs), your Postgres host, the cookies that are really set, scrypt hashing, the 03:00 UTC purge. They deliberately do **not** claim R2 uploads, Workers AI, KV, or queues, because those bindings are commented out. Analytics is the one optional feature they _do_ cover: PostHog and its consent banner ship but stay dormant until you set `PUBLIC_POSTHOG_KEY`, so the cookies page carries a conditional "Analytics and consent" section and the privacy page describes the no-analytics default ([analytics.md](analytics.md)). **They have not been reviewed by a lawyer**: every `[bracketed placeholder]` needs filling and counsel needs to check them against your entity and jurisdiction.

The policy texts are deliberately NOT in the Paraglide message catalog: a policy for another country under its own law is a different document, not a translation. Their chrome (title, meta description, last-updated line, review notice) still comes from the catalog.
