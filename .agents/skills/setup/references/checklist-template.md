# Checklist template (for the agent to fill in)

This is a **template you fill in and write to `SETUP-CHECKLIST.md`** at the repo root.
Substitute every `<PLACEHOLDER>`; include a `[[#feature]] … [[/feature]]` block only when
the user enabled that feature, and a `[[^feature]] … [[/feature]]` block only when they did
NOT. **Remove all `<…>` and `[[…]]` markers from the final file** - the output is clean
Markdown the user can check off. Keep sections numbered in order; drop numbers for omitted
sections and renumber.

---

# Setup checklist - <PRODUCT>

One-time steps to take this from a local clone to production. Check them off, then delete
this file. Full deploy flow: [docs/deploy.md](docs/deploy.md). Commands run from `app/`
unless a step names a root-level file (`.github/...`).

## 1. Accounts & CLIs

- [ ] `gh auth login` and `wrangler login` (one-time per machine)
- [ ] A Cloudflare account [[#needsPaid]](Workers **Paid** - required for email and/or workflows)[[/needsPaid]]
- [ ] (Claude Code) Cloudflare skills plugin: `/plugin marketplace add cloudflare/skills` then `/plugin install cloudflare@cloudflare`

## 2. Database - <DB_PROVIDER>

- [ ] Create a Postgres database. [[#neon]]`bunx neonctl@latest init` provisions one and prints a `DATABASE_URL`.[[/neon]][[^neon]]Get its connection string (must speak TLS - Hyperdrive requires it).[[/neon]]
- [ ] Apply the schema: `DATABASE_URL="<url>" bun run db:migrate`

## 3. Hyperdrive

- [ ] `wrangler hyperdrive create <WORKER>-db --connection-string="$DATABASE_URL" --caching-disabled`
- [ ] Put the returned id into `wrangler.jsonc` in place of `__HYPERDRIVE_ID__`

## 4. Core secret

- [ ] `wrangler secret put BETTER_AUTH_SECRET` (value: `openssl rand -base64 32`)

## 5. Auth

[[#google]]

- [ ] Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web app)
- [ ] Authorized redirect URI: `https://<DOMAIN>/api/auth/callback/google`
- [ ] `wrangler secret put GOOGLE_CLIENT_ID` and `wrangler secret put GOOGLE_CLIENT_SECRET`
      [[/google]][[^google]]
- Password and magic-link need no external setup. (Google OAuth not enabled.)
  [[/google]]

[[#captcha]]

- [ ] Cloudflare dashboard → **Turnstile** → create a widget for your domain
- [ ] Set `TURNSTILE_SITE_KEY` (the site key) in the `vars` block of `wrangler.jsonc`
- [ ] `wrangler secret put TURNSTILE_SECRET_KEY` (the secret key) - set **both**, or captcha stays off
      [[/captcha]]

## 6. Email

[[#email]]

- [ ] Cloudflare dashboard → Email → Email Routing / Email Service → **verify your sender domain** (DNS records)
- [ ] Uncomment the `send_email` block in `wrangler.jsonc`, set `EMAIL_FROM`, run `bun run cf-typegen`
      [[/email]][[^email]]
- Email is not wired to a provider: verification / magic-link / reset messages only log. For
  local testing, set `EMAIL_DEBUG=true` in `.dev.vars`. **Note:** without email, password
  sign-up verification turns itself off - enable email before launch.
  [[/email]]

## 7. Billing

[[#billing]]Creem is the Merchant of Record (it collects tax, owns chargebacks). Do this in
**test mode** first (a `creem_test_*` key auto-selects the test host).

- [ ] (Claude Code) Creem skills plugin: `/plugin marketplace add armitage-labs/creem-skills` then `/plugin install creem-api@creem-skills`
- [ ] In the Creem dashboard (or the `creem` CLI - `brew tap armitage-labs/creem && brew install creem`), create one product per paid tier:
      [[#tiers]]
  - [ ] **<TIER_NAME>** - <PRICE>/mo[[#trial]], <TRIAL_DAYS>-day free trial (set the trial on the product)[[/trial]] → its id goes in the `CREEM_PRODUCT_<VAR>` var
        [[/tiers]]
- [ ] Set those product ids in the `vars` block of `wrangler.jsonc` (`CREEM_PRODUCT_*`)
- [ ] `wrangler secret put CREEM_API_KEY` and `wrangler secret put CREEM_WEBHOOK_SECRET`
- [ ] Point a Creem webhook at `https://<DOMAIN>/api/webhooks/creem`
- [ ] Cloudflare: disable **Bot Fight Mode** (or add a skip rule for `/api/webhooks/creem`) - it challenges webhook deliveries
      [[/billing]][[^billing]]
- No billing configured. (Delete `$lib/server/billing`, `src/routes/app/billing`, and the
  pricing page if you want it gone entirely.)
  [[/billing]]

## 8. Other capabilities

[[#r2]]

- [ ] R2 uploads: `wrangler r2 bucket create <bucket>`; create an R2 API token; `wrangler secret put R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`; set `R2_ACCOUNT_ID` / `R2_BUCKET` vars; `bun run cf-typegen`
      [[/r2]][[#queues]]
- [ ] Queues: `wrangler queues create <name>`; uncomment the `queues` block; add the `queue` handler to `src/worker.ts` (snippet in docs/cloudflare.md); `bun run cf-typegen`
      [[/queues]][[#workflows]]
- [ ] Workflows: uncomment the `workflows` block; re-export the class from `src/worker.ts`; `bun run cf-typegen`
      [[/workflows]][[#ai]]
- [ ] Workers AI: uncomment the `ai` binding; `bun run cf-typegen` (needs Cloudflare auth even locally)
      [[/ai]]

## 9. CI secrets (GitHub Actions)

- [ ] `gh secret set CLOUDFLARE_ACCOUNT_ID --body "$(wrangler whoami | grep -oE '[0-9a-f]{32}' | head -1)"`
- [ ] `gh secret set DATABASE_URL --body "$DATABASE_URL"`
- [ ] Create `CLOUDFLARE_API_TOKEN` at dash.cloudflare.com/profile/api-tokens ("Edit Cloudflare Workers" template), then `gh secret set CLOUDFLARE_API_TOKEN --body "<token>"`

## 10. Ship it

- [ ] Set the owner in `.github/CODEOWNERS` (replace `@lowsbarrel` with your GitHub handle/team)
- [ ] `sh .github/repo-setup.sh` (squash-only merges + main ruleset)
- [ ] First deploy: `bun run deploy` (creates the Worker)
- [ ] Push to `main` - CI migrates and deploys from here on
      [[#domain]]
- [ ] Custom domain: uncomment `routes` in `wrangler.jsonc` (`"pattern": "<DOMAIN>", "custom_domain": true`) and confirm `url` in `src/lib/site.ts` is `https://<DOMAIN>`
      [[/domain]]

---

When every box is checked, `<PRODUCT>` is live. Keep secrets in `wrangler secret put` /
GitHub secrets - never in `wrangler.jsonc` or git.
