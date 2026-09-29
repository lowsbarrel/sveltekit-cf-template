---
name: add-plan
description: Add or change a subscription plan/tier, adjust plan limits or free trials, or change billing/entitlement behavior in this template. Use when the task mentions plans, tiers, pricing, quotas/limits, trials, upgrades, Creem, or subscription/entitlement logic.
---

# Add or change a plan / billing

The project lives in `app/` - project paths (`$lib/...`, `src/...`, `messages/`,
`wrangler.jsonc`) are relative to `app/`, and every command runs from `app/`.

Follow the "one home per concept" rule (AGENTS.md): plan **structure and limits** live in
`$lib/plans.ts`; plan **copy** in `$lib/plan-display.ts` (Paraglide); the plan ↔ Creem
**product mapping** is server-only in `$lib/server/billing/plans.ts`; **entitlement and
quota logic** in `$lib/server/billing/entitlement.ts`. Read [docs/plans.md](../../../docs/plans.md)
and [docs/billing.md](../../../docs/billing.md) for the full picture. Never duplicate a
value across these - derive it.

## Clarify first - ask, don't guess

Pricing is the user's decision, not yours. Before editing, confirm the details you don't
already have (`AskUserQuestion`): the tier's **name** and **monthly price**; **which
resources it limits** and to what number (the default limit keys are `maxTodos` /
`maxMembers` - rename to the user's real resources, e.g. projects, seats, API calls); whether
it has a **free trial** and how long; and whether this **replaces or adds to** the existing
tiers. Recommend sensible defaults, but let the user set the numbers.

## Add a new paid tier

1. **Catalog** - add the tier to `PLANS` in `$lib/plans.ts` (`priceMonthly`, `trialDays`,
   `paid: true`, `highlighted`, and every key in `limits`). Add its id to the `PLANS`
   record type so `PlanId` includes it.
2. **Creem product id** - add a `CREEM_PRODUCT_<TIER>` optional string to `App.Env` in
   `src/app.d.ts` and to the commented `vars` block in `wrangler.jsonc`, then add a branch
   in `planProductId` (`$lib/server/billing/plans.ts`).
3. **Copy** - add `plan_<id>_name` and `plan_<id>_tagline` to `messages/en.json`, add
   branches in `planName`/`planTagline` (`$lib/plan-display.ts`), then `bun run i18n:compile`.
4. **Tests** - extend `src/lib/server/billing/entitlement.spec.ts` if the tier changes
   resolution or limits.

The pricing page (`/pricing`) and in-app upgrade buttons (`/app/billing`) render from the
catalog, so they pick up the new tier with no further edits.

## Change a limit

1. Edit the number (or `null` for unlimited) in the relevant plan's `limits` in
   `$lib/plans.ts`. To add a **new** limit key, add it to `PlanLimits` and give every plan
   a value.
2. Enforce a new key where the resource is created: `requireWithinLimit(ctx, env, orgId,
'yourKey', currentCount)` before the write (it throws `limit_reached` → 402). `addTodo`
   in `$lib/server/todos/service.ts` is the worked example.
3. Optionally surface it as a feature bullet in `planFeatures` (`$lib/plan-display.ts`).

## Free trials

Trials are configured **on the Creem product** (a trial period). Creem then creates a
`trialing` subscription, which `isEntitled` already treats as paid. Set `trialDays` in the
catalog for display only ("14-day free trial" via `plan_trial`). No entitlement code
changes are needed.

## Change entitlement / dunning behavior

- Which statuses grant access: `ENTITLED_STATUSES` in `$lib/server/billing/entitlement.ts`
  (e.g. move `past_due` in/out to give a dunning grace period).
- The time backstop: `ENTITLEMENT_GRACE_MS` (how long past `current_period_end` access
  survives a missed terminal webhook).
- Which Creem events are persisted: `SUBSCRIPTION_EVENTS` and `subscriptionFromEvent` in
  `$lib/server/billing/creem.ts`. Keep `applyWebhookEvent`'s ordering guards intact - they
  stop a superseded subscription's late events from clobbering a live one.

## Definition of done

`bun run i18n:compile`, then `bun run lint && bun run check && bun run test` all green. If you added an
`env` var, it's typed in `app.d.ts` (not `worker-configuration.d.ts`, which is generated).
Land it through a branch + PR (AGENTS.md "Git & PRs"); don't commit to `main` unless asked.
