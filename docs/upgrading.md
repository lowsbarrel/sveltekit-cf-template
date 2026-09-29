# Upgrading a fork

The template is a git repository, not an npm dependency. You upgrade by pulling the
upstream template's later commits into your fork and merging them onto an upgrade
branch. There is no updater to run; the mechanism is a git remote plus a
deterministic rule for resolving the conflicts a fork guarantees.

`bun run upgrade:template` (`scripts/upgrade.mjs`) automates the mechanical steps below and
stops before the commit. The `upgrade-template` skill drives the same flow for an
agent. This doc is the canonical detail both defer to.

## Why conflicts are guaranteed

Making the template yours renames the identity token `sveltekit-cf-template` and fills in the
`__HYPERDRIVE_ID__` placeholder across `src/`, `package.json`, and
`wrangler.jsonc` (inside `app/`; CI greps these case-insensitively). Those exact spots are also
where the template evolves, so every upgrade WILL conflict there. That is
expected, not a failure: the rule below turns it into a deterministic resolution.

## Prerequisites

- A clean working tree (`git status --porcelain` empty). Stash or commit first.
- Do the merge on a fresh `upgrade/<date>` branch, never on `main`.
- Upgrade early and often. A fork that skips many releases has a distant merge
  base and a proportionally larger conflict set.

## Steps

1. **Add the template remote (one time, idempotent).** Guard it so re-running is
   a no-op:

   ```sh
   git remote get-url template >/dev/null 2>&1 || \
     git remote add template git@github.com:lowsbarrel/sveltekit-cf-template.git
   ```

2. **Fetch.** An up-to-date fetch is a no-op.

   ```sh
   git fetch template
   ```

3. **Branch off your `main`.**

   ```sh
   git switch -c upgrade/$(date +%F)
   ```

4. **Merge the template.** Onto the upgrade branch, never onto `main`:

   ```sh
   git merge --no-commit --no-ff template/main
   ```

   For a linear history, `git rebase template/main` is the alternative; the same
   conflict-classification rule applies to each replayed commit.

## Classifying conflicts

Every conflicted file falls into one of three buckets. Resolve by bucket:

| Bucket                     | Rule                 | What lives here                                                                                                                                                                                      |
| -------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Template infra**         | take **theirs**      | `docs/`, `AGENTS.md`, `.github/`, `.githooks/`, `app/scripts/`, eslint/prettier/tsconfig, vite/wrangler non-identity config, `$lib/server` plumbing (`ctx.ts`, `errors.ts`, `auth.ts`, `tenant.ts`), `.agents/skills/` |
| **Project business logic** | keep **ours**        | `$lib/server/<your-features>/`, your routes, your schema tables, your `messages/en.json` keys, your `$lib/plans.ts` values                                                                           |
| **Identity tokens**        | always keep **ours** | `app/package.json` name, `app/wrangler.jsonc` name, `app/src/lib/site.ts`, and anywhere you renamed `sveltekit-cf-template` or filled in `__HYPERDRIVE_ID__`                                           |

Never reintroduce `sveltekit-cf-template` or `__HYPERDRIVE_ID__`; CI's case-insensitive grep
rejects them. When a file mixes template infra with your edits, merge by hand:
take the upstream change, reapply your identity/business edits on top.

Ambiguous business-logic conflicts (a file that is both a template feature you
extended and something upstream reworked) need judgment. Stop and decide
deliberately; do not blanket-resolve.

For a fork created before the layout move: the template moved the whole project
into `app/`, and git's rename detection carries your fork's edits into `app/`
during the merge. A file your fork added at the old root is not renamed for you -
`git mv` it into `app/` by hand.

## Migrations

Pulling template migrations arrives as committed `.sql` files under `drizzle/`
plus a conflicting `drizzle/meta/_journal.json`. Do NOT run `bun run db:generate`
for them - they are already generated.

1. Reconcile `drizzle/meta/_journal.json` by hand: merge both entry lists in
   `idx`/`tag` order so every migration appears exactly once with a monotonic
   `idx`. A naive text merge corrupts the journal and breaks `bun run db:migrate`.
2. Re-check ordering against your own migrations. Template migrations are
   expand/contract-safe, so they apply over a live schema, but if your fork
   altered a table the template also changed, that is a genuine conflict no
   script can resolve - review it by hand.
3. Then `bun run db:migrate`.

## Resurfacing deletions

Features you deleted (`todos`, `$lib/vitest-examples`) return as modify/delete
conflicts. Keep them deleted:

```sh
git rm <path>
```

## Review

The merge is left staged and uncommitted on purpose - semantic conflicts need
human judgment before it lands.

1. Run the full gate (Docker required for `bun run db:up`):

   ```sh
   bun run db:up
   bun run lint && bun run check && bun run check:invariants && bun run check:secrets && bun run test
   ```

2. Open a PR, verify on its preview URL, and run `/code-review` on the diff.
3. Commit and merge only once green.

## Idempotency

Remote add is guarded; an up-to-date fetch and merge are no-ops. Re-running the
flow when nothing upstream changed does nothing.
