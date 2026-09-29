---
name: setup
description: All-in-one first-run setup for a SaaS built on this template. Interviews the user about their product (identity, auth, plans, capabilities), applies those choices to the codebase, tells them exactly which accounts to create and which paid plans (if any) they actually need, sets up the GitHub repo, and generates a personalized platform checklist. Use for onboarding, "set up / configure the project", "get started", or /setup.
---

# Set up the project

The project lives in `app/` - read and edit project files there (paths like
`src/lib/site.ts`, `package.json`, `wrangler.jsonc`, `messages/` are relative to `app/`),
and run every command (`bun ...`) from `app/`. Root-level files (`.github/`, `docs/`,
`.mcp.json`) stay at the repo root.

Turn this template into the user's product AND get them ready to launch it. Assume the user
may not be a developer: use plain language, explain _why_ each step exists, and never make
them guess. Work in five phases - **orient → ask → apply → tell them what to sign up for →
generate the checklist** - and confirm before applying edits.

## Phase 0 - Orient

Read `src/lib/site.ts`, `package.json` (`name`), `$lib/plans.ts`, and the commented seams in
`wrangler.jsonc` so you show current values as defaults and don't re-ask what's set.
`name: "sveltekit-cf-template"` in `wrangler.jsonc` means it's still a fresh template. Tell the user, briefly, what you're
about to do and that most of the accounts below have a free tier.

If the user is in Claude Code, recommend installing the Cloudflare skills plugin now
(`/plugin marketplace add cloudflare/skills`, then `/plugin install cloudflare@cloudflare`)
so you have first-party Workers/bindings guidance for the rest of setup - the MCP servers in
`.mcp.json` load automatically. When the user is charging money, also point them at Creem's
skills plugin and CLI. Both are in [docs/setup.md](../../../docs/setup.md#prerequisites).

## Phase 1 - Ask

Gather answers before touching anything. Use `AskUserQuestion` for the choices (batch up to
4); ask the free-text items (★) in chat. If the user is unsure, explain the trade-off and
recommend a default - don't stall.

- **Identity** - ★ product name · ★ one-line description (search engines show it) · ★
  production domain (or "not yet") · worker name (propose a kebab-case form; confirm)
- **Sign-in** (multi-select) - email + password · magic link · Google OAuth
- **Charging money?** - no (skip billing) · yes. If yes: tier shape (free only · free + one
  paid · free + two paid · custom) · trial (none · 7 · 14 days) · ★ per paid tier: name,
  monthly price, and which resources to limit
- **Extras** (multi-select) - transactional email · file uploads · background jobs · live
  progress (durable workflows) · AI · **product analytics (PostHog)** · **bot captcha
  (Cloudflare Turnstile)**
- **Database** - Neon (recommended) · Supabase · other Postgres

## Phase 2 - Apply to the codebase

Make the edits for the chosen answers (follow AGENTS.md "one home per concept" - edit the
one home, never duplicate), then run `bun run i18n:compile` / `bun run cf-typegen` where noted and
keep `bun run lint && bun run check` green.

| Answer                                  | Edit                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product / worker name                   | `package.json` + `wrangler.jsonc` `name`; `src/lib/site.ts` `name`                                                                                                                          |
| Description / domain                    | `src/lib/site.ts` `description` / `url`                                                                                                                                                     |
| Favicon                                 | prompt the user to replace `src/lib/assets/favicon.svg` (template placeholder; SVG preferred, any square image works - the root layout imports it)                                          |
| Billing tiers, prices, limits, trials   | drive the **`add-plan`** skill (`$lib/plans.ts` + `plan-display.ts` + `messages` + `planProductId`)                                                                                         |
| Email / uploads / jobs / workflows / AI | uncomment the matching block in `wrangler.jsonc`, then `bun run cf-typegen` ([docs/cloudflare.md](../../../docs/cloudflare.md))                                                             |
| Bot captcha (Turnstile)                 | set the `TURNSTILE_SITE_KEY` var in `wrangler.jsonc`; the `TURNSTILE_SECRET_KEY` secret goes in the checklist ([docs/auth.md](../../../docs/auth.md#hardening-captcha--breached-passwords)) |
| Analytics                               | set `PUBLIC_POSTHOG_KEY` in the wrangler `vars` block; it's already wired ([docs/analytics.md](../../../docs/analytics.md))                                                                 |

Also replace `@lowsbarrel` in `.github/CODEOWNERS` with the repo's GitHub owner or team
(derive it from `gh api user -q .login` / `gh repo view`, or ask) - the `sveltekit-cf-template` placeholder
check doesn't scan `.github/`. Feature flags ship ready (`$lib/flags.ts`,
[docs/flags.md](../../../docs/flags.md)); tell the user to delete the `example_flag`
reference the same way they delete `todos`. Everything else new - SHA versioning, the update
toast, rollback scripts - is always-on and needs no setup.

Do NOT create cloud resources or set secrets yourself - those go in the checklist for the
user to run. Do offer to run `sh .github/repo-setup.sh` for them (merge hygiene + branch
ruleset) once they've created the GitHub repo.

## Phase 3 - Tell them exactly what to sign up for

Based on their answers, tell the user in plain language which accounts to create, and - this
is the point - **whether they need to pay for anything**. Most start free:

| Account         | Needed for                         | Cost to start                                                                                                 |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GitHub          | the code repo + CI/CD              | Free                                                                                                          |
| Cloudflare      | hosting the app (Workers)          | Free - the **Workers Paid plan (~$5/mo)** is required only if they enabled **email** or **durable workflows** |
| Postgres (Neon) | the database                       | Free tier is plenty to launch                                                                                 |
| Creem           | taking payments (only if charging) | Free to open; takes a per-sale cut as Merchant of Record                                                      |
| Google Cloud    | "Sign in with Google" (only if on) | Free                                                                                                          |
| PostHog         | analytics (only if on)             | Generous free tier                                                                                            |
| A domain name   | a custom URL + sending email       | ~$10/yr from any registrar                                                                                    |

Call out the two real decisions: (1) a domain is needed for a custom URL and for
sending email from your own address; (2) Cloudflare's paid plan is only needed for email or
workflows - otherwise everything runs free.

## Phase 4 - Generate the checklist

Write a personalized **`SETUP-CHECKLIST.md`** at the repo root from
[references/checklist-template.md](references/checklist-template.md): the user's real values
substituted (worker name, domain, each paid tier → its Creem product and `CREEM_PRODUCT_*`
var), only the sections for what they enabled, and every account/secret/command spelled out.
Then summarize the top must-do steps and point them at [docs/setup.md](../../../docs/setup.md)
to run locally and [docs/deploy.md](../../../docs/deploy.md) to go live.
