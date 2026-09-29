# Setup

How to go from a fresh checkout to a running app, passing tests, and a production deploy. Written for people and AI agents alike: every step is a command you can run and a way to verify it worked.

> **Using an AI coding agent?** Run the **`setup`** skill (or **`/setup`**) - it interviews you about your product (name,
> domain, auth methods, plans, capabilities), applies the choices to the codebase, and
> writes you a personalized `SETUP-CHECKLIST.md` with the exact platform steps. This page is
> the manual version of the same thing.

Two companion documents, then the rest of this folder:

- [AGENTS.md](../AGENTS.md) - the architectural invariants. If you are an AI agent, read it before writing code; it is the contract this codebase is built on.
- [architecture.md](architecture.md) - the repo layout and the patterns everything follows.
- Per-topic deep dives: [adding-features.md](adding-features.md), [database.md](database.md), [auth.md](auth.md), [accounts.md](accounts.md), [notifications.md](notifications.md), [realtime.md](realtime.md), [multi-tenancy.md](multi-tenancy.md), [billing.md](billing.md), [plans.md](plans.md), [blog.md](blog.md), [newsletter.md](newsletter.md), [cloudflare.md](cloudflare.md), [ai-compliance.md](ai-compliance.md), [testing.md](testing.md), [i18n.md](i18n.md), [analytics.md](analytics.md), [ui.md](ui.md), [security.md](security.md), [deploy.md](deploy.md).

## Prerequisites

| Tool    | Version                | Notes                                                              |
| ------- | ---------------------- | ------------------------------------------------------------------ |
| Node.js | ≥ 24                   | declared in `app/package.json` `engines`; CI runs Node 24          |
| Bun     | pinned in package.json | install from [bun.sh](https://bun.sh); CI uses `oven-sh/setup-bun` |
| Docker  | any recent             | local Postgres via `compose.yaml`; tests and E2E need it           |

A Cloudflare account is **not** needed for local dev or tests - the Hyperdrive binding points at the compose database, and KV/R2/queues are emulated. You need one only to deploy.

**Building with an AI coding agent?** The repo already wires the relevant MCP servers (Cloudflare, Svelte, Context7, Neon) in `.mcp.json`. Install Cloudflare's official **skills plugin** on top, so the agent gets first-party Workers/bindings guidance while it writes code (Claude Code):

- `/plugin marketplace add cloudflare/skills`
- `/plugin install cloudflare@cloudflare`

Charging money? Add Creem's skills plugin too (Claude Code) - Creem is the Merchant-of-Record billing this template uses. It also ships a Homebrew CLI for managing products and subscriptions from the terminal (`brew tap armitage-labs/creem && brew install creem`) and portable skill files at <https://creem.io/SKILL.md>. (Caveat: the CLI's `login` currently rejects `creem_test_*` keys - it's live-mode only - so for test mode use the REST API / SDK, which the app already does.)

- `/plugin marketplace add armitage-labs/creem-skills`
- `/plugin install creem-api@creem-skills`

## 1. First run (local)

```sh
cd app              # the SvelteKit app + Worker live here; every command below runs from app/
bun install     # also runs prepare: svelte-kit sync, cf-typegen, i18n:compile
bun run db:up       # Postgres 17 in Docker, waits until healthy
bun run db:migrate  # apply committed migrations from drizzle/
bun run dev         # http://localhost:5173
```

`bun run dev` seeds `.dev.vars` from `.dev.vars.example` on first run (`scripts/ensure-dev-vars.mjs`). `.dev.vars` is gitignored and holds dev secrets - never commit it, never deploy it.

**Verify:** `curl -s http://localhost:5173/api/health` returns ok, and the landing page renders. Sign up at `/signup`; with no email binding configured, set `EMAIL_DEBUG=true` in `.dev.vars` to get verification/magic links printed to the dev console (the link is a bearer credential - this flag must never exist in production).

## 2. If you created a repo from this template

CI fails until the template identity is replaced (the guard is `.github/workflows/ci.yml` → "Fail if template placeholders were not replaced"):

1. Replace `sveltekit-cf-template` (case-insensitive) everywhere in `app/package.json`, `app/wrangler.jsonc`, and `app/src/`:
   - `app/package.json` → `name`
   - `app/wrangler.jsonc` → `name` (this becomes the Worker name)
   - `app/src/lib/site.ts` → `name`, `url`, `description` (public identity: SEO, sitemap, JSON-LD)
   - `app/src/lib/assets/favicon.svg` → swap the placeholder favicon for your own (SVG; the root layout imports it)
2. Replace `__HYPERDRIVE_ID__` in `app/wrangler.jsonc` - see [Deploy](#5-deploy-to-production) for how to create the Hyperdrive config.
3. For PR previews, replace `__PREVIEW_HYPERDRIVE_ID__` in the `previews` block of `app/wrangler.jsonc` with a second Hyperdrive config pointed at a preview database. CI does not check this one; the preview job fails until it is set.
4. From the repo root, run `sh .github/repo-setup.sh` (needs `gh` with admin) - applies squash-only merges and the `main` branch ruleset; GitHub templates copy files but not settings.

The example feature (todos: schema → service → protected page) demonstrates the architecture. Delete it with its tests when you start building your own features.

## 3. Everyday commands

| Command                   | What it does                                                                     |
| ------------------------- | -------------------------------------------------------------------------------- |
| `bun run dev`             | Vite dev server (SSR in Node, Miniflare-backed bindings)                         |
| `bun run preview`         | Build + `wrangler dev` - the real Workers runtime, port 8787                     |
| `bun run test`            | Migrations, then unit tests: server code inside workerd + components in Chromium |
| `bun run test:e2e`        | Playwright: builds, boots `wrangler dev`, drives HTTP end to end                 |
| `bun run check`           | cf-typegen + i18n compile + strict svelte-check                                  |
| `bun run lint` / `format` | Prettier check + ESLint / Prettier write                                         |
| `bun run db:studio`       | Drizzle Studio on the local database                                             |

One-time: `bunx playwright install chromium` before the first `bun run test` (component tests run in real Chromium).

**Definition of done:** `bun run lint`, `bun run check`, `bun run check:invariants`, `bun run check:secrets`, and `bun run test` all pass - the same set the pre-commit hook runs.

## 4. After you change X, run Y

These are not optional - skipping them is the most common way to end up with confusing failures:

| You changed                   | You must run                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/db/schema.ts` | `bun run db:generate` + `bun run db:migrate`, **and add every new table to `tests/isolate-db.ts`** - a missing table leaks rows between tests |
| `wrangler.jsonc`              | `bun run cf-typegen` (regenerates `src/worker-configuration.d.ts`)                                                                            |
| `messages/*.json`             | `bun run i18n:compile` (`check` and `prepare` also run it)                                                                                    |

Never hand-edit generated output: `src/worker-configuration.d.ts`, `src/lib/paraglide/`, and the SQL migrations in `drizzle/` (generated by drizzle-kit, committed, applied by CI).

## 5. Deploy to production

The full first-time provisioning sequence - production Postgres, Hyperdrive (`--caching-disabled`), `BETTER_AUTH_SECRET`, GitHub Actions secrets, first deploy, repo policy - is one canonical copy-paste block in **[deploy.md](deploy.md#first-time-provisioning-cli)**, with the CI pipeline and the remaining dashboard-only steps. After the first push to `main`, CI migrates and deploys on every merge. Once you have a domain, set it in `src/lib/site.ts` (`url`) - canonical URLs and the sitemap come from there, never from the request.

## 6. Opt-in features

Each is a commented seam - uncomment, create the resource, `bun run cf-typegen`. Details in the doc named in the table.

| Feature                  | Enable via                                                                                                                | Doc                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Google OAuth             | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (`.dev.vars` locally, secrets in prod)                                        | [auth.md](auth.md)                                       |
| Bot captcha (Turnstile)  | `TURNSTILE_SITE_KEY` var + `TURNSTILE_SECRET_KEY` secret (both, or captcha stays off)                                     | [auth.md](auth.md#hardening-captcha--breached-passwords) |
| Transactional email      | `send_email` binding + `EMAIL_FROM` var (Cloudflare Email Service, Workers Paid)                                          | [auth.md](auth.md#email)                                 |
| Billing (Creem, MoR)     | `CREEM_PRODUCT_*` var per paid plan + `CREEM_API_KEY` / `CREEM_WEBHOOK_SECRET` secrets + webhook at `/api/webhooks/creem` | [billing.md](billing.md)                                 |
| Object storage (R2)      | `r2_buckets` block + presigning keys                                                                                      | [cloudflare.md](cloudflare.md)                           |
| Key-value store (KV)     | `kv_namespaces` block                                                                                                     | [cloudflare.md](cloudflare.md)                           |
| Background queues        | `queues` block + consumer in `src/worker.ts`                                                                              | [cloudflare.md](cloudflare.md)                           |
| Durable workflows        | `workflows` block (`$lib/server/workflows/`)                                                                              | [cloudflare.md](cloudflare.md)                           |
| AI (Workers AI + AI SDK) | `ai` binding + a streaming endpoint (snippet in cloudflare.md)                                                            | [cloudflare.md](cloudflare.md#ai-opt-in)                 |
| Cached reads             | second Hyperdrive binding `HYPERDRIVE_CACHED` (~60s stale, never for auth)                                                | [database.md](database.md)                               |

Two features ship **enabled**, not as seams: **plans & limits** (the free tier and
per-plan quotas work out of the box; paid tiers just need Creem products - [plans.md](plans.md))
and the **Markdown blog** (sample posts render immediately - [blog.md](blog.md)).

## 7. Notes for AI agents

- [AGENTS.md](../AGENTS.md) is the contract: routes are adapters, logic lives in `$lib/server/<feature>/service.ts`, authorization lives in services, failures are `AppError`s. Follow it before any local convention you infer.
- Use `bun`, not npm, pnpm, or yarn - the version is pinned and the lockfile is enforced.
- `.mcp.json` registers MCP servers (Cloudflare docs/bindings/observability, Svelte, Context7, Neon) if your harness supports them.
- `.dev.vars` and `.env*` files are gitignored (only the `*.example` templates are committed) and never deployed. Nothing in them is needed to write code.
- The truncate list in `tests/isolate-db.ts` and the two-token rename guard in CI are the traps most often hit by automated changes - see sections 2 and 4.

## Troubleshooting

- **Tests hit the wrong schema / confusing 500s locally** - two projects built from this template can't both run compose Postgres: they both bind host port 5432, and whichever container owns it wins. Change the port in `compose.yaml`, `drizzle.config.ts`, and `wrangler.jsonc`'s `localConnectionString`.
- **`bun run test` fails immediately** - is Docker running and `bun run db:up` done? The test script runs migrations first, against the compose database.
- **Component tests can't find a browser** - `bunx playwright install chromium`.
- **CI fails on "template placeholders"** - you still have `sveltekit-cf-template` or `__HYPERDRIVE_ID__` in `app/package.json`, `app/wrangler.jsonc`, or `app/src/` (the grep is case-insensitive). See section 2.
- **Hyperdrive can't reach your database** - Hyperdrive only connects to origins that speak TLS. Hosted Postgres does out of the box; self-hosted (including via Cloudflare Tunnel) needs server certificates first.
- **Magic link / verification email never arrives locally** - there is no mail binding in dev; set `EMAIL_DEBUG=true` in `.dev.vars` and the link is logged instead.
