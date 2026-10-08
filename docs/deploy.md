# Deploy & infrastructure

How code reaches production, what CI gates it, and how much of the infrastructure you can provision without opening a dashboard (almost all of it).

## Infrastructure as code - the philosophy

For a single Worker, **`wrangler.jsonc` _is_ the infrastructure definition**: bindings (Hyperdrive, KV, R2, queues, workflows, AI, rate limiter), cron triggers, observability, even the custom domain (`routes` seam). `wrangler deploy` reconciles it on every deploy - declarative, versioned, reviewed in PRs. The few pieces wrangler can't declare (creating the Hyperdrive config, secrets, GitHub repo settings) are the one-time CLI steps below.

Terraform (Cloudflare has an official provider) or [Alchemy](https://alchemy.run) become worth it when you manage many workers, DNS zones, or WAF rules across environments - for this template they would add state management without removing any of the remaining manual steps (which are third-party dashboards, not Cloudflare).

## First-time provisioning (CLI)

One interactive login per machine - `gh auth login` and `wrangler login` - then:

```sh
cd app   # the SvelteKit app + Worker; the steps below run from app/ unless noted

# 1. Rename the template identity (sveltekit-cf-template → your app) across the
#    app/ files: src/ (site.ts, consent.ts, blog content, …), package.json, and
#    wrangler.jsonc - CI greps all three case-insensitively and fails until you do.

# 2. Production Postgres → run the committed migrations against it.
#    (No DB yet? `bunx neonctl@latest init` provisions one and prints the URL.)
DATABASE_URL="<your Postgres URL>" bun run db:migrate

# 3. Hyperdrive (caching disabled - see database.md), then put the returned id
#    into wrangler.jsonc in place of __HYPERDRIVE_ID__.
wrangler hyperdrive create <app>-db --connection-string="$DATABASE_URL" --caching-disabled

# 4. First deploy - creates the Worker (secrets need it to exist).
bun run deploy

# 5. Worker secret. Uploading it deploys a new version, so the app picks it up.
wrangler secret put BETTER_AUTH_SECRET   # e.g. openssl rand -base64 32

# 6. CI secrets so GitHub Actions can migrate + deploy.
gh secret set CLOUDFLARE_ACCOUNT_ID --body "$(wrangler whoami | grep -oE '[0-9a-f]{32}' | head -1)"
gh secret set DATABASE_URL --body "$DATABASE_URL"
gh secret set CLOUDFLARE_API_TOKEN --body "<token, see the table below>"

# 7. Repo policy: squash-only merges + the main ruleset (runs from the repo root).
cd .. && sh .github/repo-setup.sh
```

After this, pushing to `main` migrates and deploys through CI; PR previews work too.

### The dashboard steps that remain

| Step                                                               | Where                                                                                    | Why it can't be scripted                                                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Create `CLOUDFLARE_API_TOKEN` ("Edit Cloudflare Workers" template) | [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) | Minting a token requires a token - the trust root is manual by design                                        |
| Verify an email sender domain                                      | Cloudflare dashboard → Email Service                                                     | Public-beta product; needs DNS verification UX                                                               |
| Create the Creem product + webhook secret                          | [creem.io](https://creem.io) dashboard                                                   | Third-party onboarding ([billing.md](billing.md#setup))                                                      |
| Create a Google OAuth client                                       | Google Cloud Console                                                                     | Google offers no sane CLI for this ([auth.md](auth.md#sign-in-methods))                                      |
| Create a Turnstile widget (site + secret key)                      | Cloudflare dashboard → Turnstile                                                         | Widget keys are per-site, minted in the dashboard ([auth.md](auth.md#hardening-captcha--breached-passwords)) |
| WAF rate-limit rule / Bot Fight Mode off                           | Cloudflare dashboard → your zone                                                         | Zone-level settings, only relevant once you have a custom domain                                             |

Everything else - database, Hyperdrive, Worker, secrets, KV/R2/queues when you opt in, the custom domain via the `routes` seam - is CLI or config.

## Custom domain as code

Uncomment in `wrangler.jsonc` once the domain's zone is on your Cloudflare account:

```jsonc
"routes": [{ "pattern": "app.example.com", "custom_domain": true }]
```

`wrangler deploy` creates the DNS record and certificate - no dashboard. Then set the same origin in `src/lib/site.ts` (`url`): canonical URLs and the sitemap come from there, never from the request.

**Going to a custom domain deactivates your `*.workers.dev` subdomain - silently.** Anything still pointing at the old workers.dev URL then breaks with no error. Treat the switch as a **rewiring** step, not just a DNS one, and update every cross-origin URL:

- **The Creem webhook** - repoint it in the Creem dashboard to `https://<domain>/api/webhooks/creem`. It lives outside the repo, so nothing in the green gate reminds you; a missed webhook leaves orgs stuck on the wrong plan (see [billing.md](billing.md#setup) - this is exactly the failure a resync escape hatch is for).
- **Any `PUBLIC_*_URL`** for a sidecar worker (e.g. a realtime service on its own `workers.dev` URL) - repoint the var and redeploy.
- **`site.ts`'s `url`** and any other absolute URL baked into config.

Re-verify each after the switch - none of them fail loudly on their own.

## CI pipeline

`.github/workflows/ci.yml` - actions pinned to commit SHAs, `GITHUB_TOKEN` read-only (raised to `pull-requests: write` only in the preview job). The workflow files carry no comments (`check:invariants` enforces it); their reasoning lives here. Concurrency cancels superseded PR runs but never a push to `main`: cancelling between the production migration and the deploy would leave the new schema running old code.

- **conventions** (PRs) - PR title and every commit must be [Conventional Commits](https://www.conventionalcommits.org) (`type(scope): summary`, ≤72 chars). Zero-dependency inline check; Dependabot is configured to comply. The title reaches the shell through an env var, never inline interpolation, because PR titles are attacker-controlled input.
- **test** - placeholder guard, invariant + secret checks (`check:invariants`, `check:secrets`), lint, typecheck, unit + browser tests (Postgres service container), build, bundle-size guardrail (fails over 2 MB gzipped, far below the platform limit but early), E2E.
- **portability** - builds with `adapter-node`, boots `build/index.js`, smoke-tests it. Fails the moment a Cloudflare binding leaks into code that should be portable.
- **audit** - `bun audit --prod --audit-level=high`: fails on a high/critical advisory in the production dependency tree. Reads the committed lockfile (no install). Runtime-reachable transitive fixes are pinned via `overrides` in `package.json`; build-time-only advisories (Vite/SvelteKit toolchain, never bundled into the Worker) are passed as `--ignore <GHSA>` flags on the `bun audit` call in CI. Drop an ignore once kit/vite ship a patched transitive.
- **preview** (PRs) - `wrangler preview --name pr-<n>` ([Worker Previews](https://developers.cloudflare.com/workers/previews/), open beta, needs Wrangler >= 4.135): an isolated, production-like deploy of the branch with its own URL, commented on the PR and torn down on close by `preview-cleanup.yml`. Like `deploy`, it is skipped on the template repository itself and on fork PRs, which can't read secrets. Bindings come from the `previews` block in `wrangler.jsonc`, which never inherits production and must omit crons, routes, and queue consumers; `RATE_LIMITER` is left out on purpose (the hook fails open, which is fine for a preview), and its Hyperdrive id is a placeholder to point at a preview database. **DO / KV / R2 get isolated per-branch state** when the `previews` block points them at separate preview resources - which is what makes a Durable Object previewable at all (the older version-URL previews couldn't). The external Postgres is **not** isolated by this: previews use whatever the preview `HYPERDRIVE` binding points at (a shared preview DB by default). For true per-branch data, point it at an ephemeral database or schema - provider-agnostic; managed branching (Neon, Supabase, ...) is just one convenient option, never a requirement. PR migrations aren't auto-applied, so verify schema-changing PRs locally or against that preview DB.
- **deploy** (`main` only) - Drizzle migrations against production (`DATABASE_URL` secret), then `wrangler deploy`. Requires both gates green. Migrations run **before** traffic shifts to the new code.
- **smoke** (`main` only, after `deploy`) - runs `bun run test:smoke` (Playwright, `smoke/`) against the live URL from the deploy job output (`needs.deploy.outputs.url`), or `vars.PRODUCTION_URL` when set for a custom domain whose `workers.dev` URL is deactivated. Read-only checks (`/api/health`, home, `/pricing`, `/login`); it fails the run loudly if the deployment is unhealthy. Deliberately excluded from the `ci` gate (push-only, post-deploy), mirroring `preview` and `deploy`.
- **trivy** - blocking supplementary scan (`trivy fs`): known-vulnerable deps, hardcoded secrets, and config misconfigurations, at `HIGH,CRITICAL` with `ignore-unfixed`, failing the run on a finding (`exit-code: 1`). It joins `audit` in the `ci` gate, which remains the dependency-tree gate. SARIF upload to the Security tab is omitted - it needs GitHub Advanced Security on a private repo.
- **ci** - a gate job that `needs` every blocking job (conventions, test, portability, audit, trivy) and fails unless all succeeded. The branch ruleset (`.github/rulesets/main.json`) requires **only `ci`**, so adding a job to its `needs` makes it blocking with no ruleset edit and no `repo-setup.sh` re-run. It runs with `always()` and checks each result explicitly, because a skipped required check can otherwise be reported to branch protection as passing. `preview`, `deploy`, and `smoke` are deliberately excluded (secrets/infra, push-only, post-deploy).

Dependabot (`.github/dependabot.yml`) updates the pinned actions and the `bun` ecosystem weekly with a 7-day cooldown and Conventional Commit messages; bun minor and patch bumps arrive as one grouped PR, majors one by one. The ecosystem must be `bun`, not `npm`: npm never regenerates `bun.lock`, so its PRs fail `bun install --frozen-lockfile`. Dependabot's updater runs an older bun that only reads `bun.lock` `"lockfileVersion": 1`, and fails every job on 2. Bun 1.4 writes 2 only when it creates a lockfile from scratch and keeps an existing 1 on every later save, so if you ever delete and regenerate `bun.lock`, set the marker back to 1 (the format is otherwise identical); `check:invariants` fails until you do.

The first push to `main` creates the Worker (unless the CLI steps above already did); PR previews work after that, once `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` are set and the preview `HYPERDRIVE` id is filled in. `wrangler preview` is driven from Actions **after** the test gate on purpose - **don't connect Workers Builds / dashboard Git**, which would run previews before the gate and bypass it.

## Manual deploy

`bun run deploy` builds and deploys from your machine with your `wrangler login`. Fine for the first deploy and emergencies; let CI do the rest so migrations and gates stay in the loop.

## Rollback

`bun run deploy:rollback` (`wrangler rollback`, or the Versions UI) shifts traffic back to a previous version instantly - every deploy is an immutable version, so there's nothing to rebuild. `bun run deployments` lists recent versions and their ids. Remember migrations are decoupled: rolling back code does not roll back the schema, which is why migrations must stay backward-compatible for one version (expand → migrate → contract).

## Progressive rollout (opt-in)

Continuous deploy ships to 100%. When a change warrants a canary, split traffic across versions instead:

```sh
bun run deploy:canary       # build + upload a new version, no traffic shift
bun run deploy:promote      # wrangler versions deploy - e.g. <version-id>@10, then @100
```

The expand/contract rule bites harder here: during a split, two code versions serve one database at once.

## Versioning & the update prompt

`kit.version.name` (in `vite.config.ts`) is the build's **git SHA** - `GITHUB_SHA` in CI, `git rev-parse` locally. SvelteKit serves it at `_app/version.json`; clients poll it (`version.pollInterval`) and `$lib/components/UpdateToast.svelte` prompts a reload when production changes. Track releases by SHA in Workers Logs; internal apps rarely need hand-curated semver.

## Feature flags are the release gate

Deploying is not releasing. Land risky work behind a flag (default off), ship it dark on the normal continuous deploy, then turn it on - gradually, by raising its rollout - with no revert and an instant off-switch. This is the "release when I decide" control that replaces long-lived release branches. See [flags.md](flags.md).

## Staging + a manual gate (opt-in)

The default deploys straight to prod. For a regulated/enterprise flow, insert a persistent staging environment and a human approval gate:

1. Add an `env.staging` block to `wrangler.jsonc` with its **own** Hyperdrive/DB, secrets, and bindings; deploy it with `wrangler deploy --env staging`.
2. Add a `staging` CI job on push to `main` that deploys `--env staging` and migrates the staging DB.
3. Put the production `deploy` job behind a GitHub **Environment** (`production`) with a required reviewer, so it waits for approval before promoting.

## Backups (opt-in)

The database provider's PITR (Neon) is the primary disaster-recovery mechanism. A separate scheduled workflow, `.github/workflows/backup.yml`, adds an off-provider copy: a nightly `pg_dump` (over an **unpooled, read-only `BYPASSRLS`** connection - see [backups.md](backups.md)), `age`-encrypted, uploaded to R2 with a lifecycle rule for bounded retention. It needs its own secrets (`DATABASE_URL_BACKUP`, the `R2_*` set, `BACKUP_AGE_PUBLIC_KEY`) and is skipped on the template's own repo until you set them. Restore and the erasure-replay step are in [backups.md](backups.md).

## Observability

`observability.enabled` is on in `wrangler.jsonc`, and `upload_source_maps` is true, so Workers Logs ingests and indexes every `console.log({ ... })` (log structured objects, per AGENTS.md), plus errors and invocation metadata - queryable in the dashboard Query Builder with source-mapped stack traces. Retention is 7 days.

Opt-in knobs, all commented in the `observability` block:

- `head_sampling_rate` (0 to 1, default 1) - log a fraction of requests to cut cost at high traffic.
- `logs.invocation_logs` - CPU time and wall time per invocation.
- `traces` - end-to-end request tracing; auto-instruments fetch, KV, R2, and Durable Object calls with no code change. Free during the current beta.

For retention beyond 7 days or shipping to Sentry / Grafana / Honeycomb / R2 / S3, use OpenTelemetry export, Workers Logpush, or a Tail Worker.
