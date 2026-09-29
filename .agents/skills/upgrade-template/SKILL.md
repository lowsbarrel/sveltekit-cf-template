---
name: upgrade-template
description: Pull later template improvements into this fork. Use when asked to upgrade the template, pull template updates, sync with upstream, or get newer template improvements.
---

# Upgrade the template

The project files live in `app/`; run every command in this runbook from there
unless it names a root-relative path (like `docs/` or `.github/`).

Pull upstream template commits into this fork and merge them onto an upgrade
branch. Follow [docs/upgrading.md](../../../docs/upgrading.md) for the full
detail - the conflict-classification table, the migration caveat, and the review
path all live there. Do not restate them here; this is the runbook.

## Runbook

1. **Snapshot.** Record the current HEAD (`git rev-parse HEAD`) so you can
   report and, if needed, reset. Abort if the working tree is dirty
   (`git status --porcelain` non-empty) - tell the user to stash or commit first.

2. **Run the orchestrator.** From `app/`, `node scripts/upgrade.mjs` (wired as
   `bun run upgrade:template`).
   It verifies the clean tree, adds the `template` remote if absent, fetches,
   creates or reuses an `upgrade/<date>` branch, and runs
   `git merge --no-commit --no-ff template/main`. It never commits. If the script
   is absent, do the manual remote-add / fetch / branch / merge from
   docs/upgrading.md.

3. **Classify and resolve each conflict** with the infra-vs-business rule in
   docs/upgrading.md. Resolve identity-token conflicts to this project's renamed
   values - never reintroduce `sveltekit-cf-template` or `__HYPERDRIVE_ID__` (CI greps for them
   case-insensitively). Keep deleted features (`todos`, `$lib/vitest-examples`)
   deleted (`git rm`). Stop and ask the user on any ambiguous business-logic
   conflict; do not guess.

4. **Reconcile migrations.** If the merge pulled `drizzle/` migrations, hand-merge
   `drizzle/meta/_journal.json` by `idx`/`tag` order (do NOT run `db:generate`),
   then `bun run db:migrate`.

5. **Run the gate and fix fallout.** `bun run db:up` (needs Docker) first, then
   `bun run lint && bun run check && bun run check:invariants && bun run check:secrets &&
bun run test`. If Docker is unavailable, say so and note the preview URL is the
   fallback verification.

6. **Summarize for the user.** The merge is left staged and uncommitted for
   review. Report: template commits pulled, files taken-theirs vs kept-ours,
   migrations applied, gate result, and manual follow-ups (secrets, dashboard
   steps). Do not auto-commit; the user reviews, opens a PR, and merges.
