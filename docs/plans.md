# Plans & limits

Free accounts, paid tiers, free trials, and per-plan quotas - all driven from one catalog. Billing mechanics (Creem as Merchant of Record, webhooks, the portal) are in [billing.md](billing.md); this page is about **tiers and their limits**.

> **Using an AI coding agent?** The **`add-plan`** skill (**`/add-plan`**) drives adding a tier, changing a limit, trials, and entitlement tweaks.

## The shape

- Every organization is on **`free`** until it subscribes - a real tier with its own limits, not a locked demo.
- Paid tiers map to **Creem products**. Subscribing (or starting a trial) moves the org onto that tier; cancelling drops it back to free.
- A **limit** is a number (the cap) or `null` (unlimited). Limits are enforced in services with `requireWithinLimit`, which throws `limit_reached` (HTTP **402**) so the UI can show an upgrade prompt.

## The catalog - `$lib/plans.ts`

The single source of truth, shared by client and server (like `$lib/permissions.ts`), so the pricing page and the quota checks can never disagree:

```ts
export const PLANS = {
	free: {
		id: 'free',
		priceMonthly: 0,
		trialDays: 0,
		paid: false,
		highlighted: false,
		limits: { maxTodos: 10, maxMembers: 1 }
	},
	pro: {
		id: 'pro',
		priceMonthly: 20,
		trialDays: 14,
		paid: true,
		highlighted: true,
		limits: { maxTodos: 1000, maxMembers: 10 }
	},
	team: {
		id: 'team',
		priceMonthly: 50,
		trialDays: 0,
		paid: true,
		highlighted: false,
		limits: { maxTodos: null, maxMembers: null }
	}, // null = unlimited
	lifetime: {
		id: 'lifetime',
		priceMonthly: 0,
		priceOnce: 300,
		oneTime: true,
		trialDays: 0,
		paid: true,
		highlighted: false,
		limits: { maxTodos: null, maxMembers: null }
	}
};
```

The **plan ↔ Creem product** mapping is server-only (`$lib/server/billing/plans.ts`), so the prerendered pricing page never needs a product id. Display copy (names, taglines, feature bullets) is Paraglide, resolved in `$lib/plan-display.ts` from the limits - so a bullet can't drift from what's enforced.

## Enforcing a limit

The pattern, from the shipped todos example (`$lib/server/todos/service.ts`):

```ts
import { requireWithinLimit } from '../billing/entitlement';

export async function addTodo(ctx, env, actor, orgId, input) {
	const [row] = await ctx.db.select({ value: count() }).from(todo).where(eq(todo.userId, actor.id));
	await requireWithinLimit(ctx, env, orgId, 'maxTodos', row?.value ?? 0); // throws limit_reached at the cap
	// ...insert
}
```

`requireWithinLimit` resolves the org's current plan (its paid tier while entitled, else free) and compares your count to that plan's limit. It's agnostic about _what_ is counted - you supply the current count.

## Add a new limit

1. Add the key to `PlanLimits` in `$lib/plans.ts` and give every plan a value.
2. (Optional) Add a feature bullet in `planFeatures` (`$lib/plan-display.ts`) + a message.
3. Call `requireWithinLimit(ctx, env, orgId, 'yourKey', currentCount)` before the write.

## Add a new paid tier

1. Add it to `PLANS` (`$lib/plans.ts`) with its price, trial, and limits.
2. Add its Creem product id: a `CREEM_PRODUCT_<TIER>` var (`wrangler.jsonc` + `app.d.ts`) and a case in `planProductId` (`$lib/server/billing/plans.ts`).
3. Add display copy: `plan_<id>_name` / `plan_<id>_tagline` messages and branches in `$lib/plan-display.ts`.

The pricing page and the in-app upgrade buttons render from the catalog, so they pick the new tier up automatically.

## One-time (lifetime) tiers

A tier can be sold **once** instead of recurring: mark it `oneTime: true` with a `priceOnce` (the `lifetime` tier ships as the example). Its Creem product is a one-time product (`CREEM_PRODUCT_LIFETIME`), and its purchases land in a dedicated `purchase` table rather than the `subscription` row - non-expiring by construction (see [billing.md](billing.md#one-time-lifetime-purchases)).

Entitlement is **the best of the subscription and any paid purchases**: `planForOrg` ranks both by `PLAN_LIST` order (`bestPlan`/`planRank`) and returns the most generous, so a lifetime purchase is never downgraded by a free or expired subscription that also exists on the org. `planPrice` renders a `oneTime` tier as a one-time amount (`plan_price_once`) rather than `€/mo`.

## Free trials

Trials are configured **on the Creem product** (a trial period). When a user checks out, Creem creates a `trialing` subscription, which the entitlement logic already treats as paid ([billing.md](billing.md)) - the org gets the tier's limits for the trial, then converts to `active` on first charge or drops to free if cancelled. `trialDays` in the catalog is display copy only ("14-day free trial"); the real trial length lives in Creem.

## What the user sees

- **`/pricing`** (public, prerendered) renders every tier from the catalog.
- **`/app/billing`** shows the org's current plan and, for owners/admins, an upgrade button per available paid tier plus the Creem portal to manage or cancel.

## Not billing-gated

Business quotas like this are plan limits. Access control (who may do a thing at all) is still roles and permissions - see [auth.md](auth.md#organizations--permissions).
