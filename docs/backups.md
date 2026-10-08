# Backups & erasure

Two layers, on purpose.

- **Primary disaster recovery is the database provider's PITR.** Neon (the
  recommended production Postgres) keeps continuous point-in-time history and
  restores to any second in its window from the console or CLI. That is the real
  recovery mechanism: nothing to build, consistent, restore in minutes.
- **This repo adds a second, off-provider copy**: a nightly logical `pg_dump`
  uploaded to R2 (`.github/workflows/backup.yml`). It survives losing the
  provider account or region, restores specific tables into another environment,
  and is the independent copy a compliance/retention policy can point at. It is
  defense in depth, not a replacement for PITR.

## The backup job

`pg_dump --format=custom` (schema + data + sequences) piped through `gzip`,
encrypted with `age`, uploaded to `s3://<bucket>/backups/`. Runs at
04:00 UTC daily and on `workflow_dispatch`.

### Setup

1. **A read-only, unpooled connection string.** `pg_dump` needs only `SELECT`,
   and it must **not** run over the pooled host. Create a least-privilege role:

   ```sql
   CREATE ROLE backup LOGIN PASSWORD '...' BYPASSRLS;
   GRANT pg_read_all_data TO backup;   -- Postgres 14+ built-in role
   ```

   Its connection string must use the **direct** host, not the `-pooler` one
   (Neon's pooler and this app's Hyperdrive binding are poolers; `pg_dump` over a
   pooler is unsupported).

   `BYPASSRLS` is required, not optional: `note` is `FORCE`d under row-level
   security ([multi-tenancy.md](multi-tenancy.md)) and `pg_dump` turns
   `row_security` off, so a plain role - even one with `pg_read_all_data` - errors
   on the policy instead of dumping the table.

2. **Secrets** (`gh secret set ...`): `DATABASE_URL_BACKUP` (the read-only
   unpooled URL), `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, and `BACKUP_AGE_PUBLIC_KEY` (an `age` recipient;
   generate a keypair with `age-keygen` and keep the private key offline for
   restores). Encryption is **required**: the dump is a full copy of every
   credential hash, session and reset token, and all PII, so the job fails rather
   than upload it in clear. R2 also encrypts at rest, but with keys Cloudflare
   holds; `age` keeps the dump readable only to you.

3. **Bounded retention** (the GDPR "cycle out on a schedule" control). Set an R2
   lifecycle rule to expire the `backups/` prefix, e.g. after 30 days:

   ```sh
   wrangler r2 bucket lifecycle add <bucket> --prefix backups/ --expire-days 30
   ```

The job **auto-skips (green) until `DATABASE_URL_BACKUP` is set**, so it is inert
on the template repo and on any fork that has not opted in - nothing to delete.
Once the URL is set it runs on schedule; if the age key is missing it **fails
loudly** rather than skip, so a misconfigured backup can't hide as a passing run.

## Restore

```sh
aws s3 cp "s3://$R2_BUCKET/backups/<file>" ./restore --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
age -d -i backup-age.key -o restore.pgc.gz ./restore    # only if encrypted
gunzip restore.pgc.gz
pg_restore --clean --if-exists --no-owner --dbname "$TARGET_DATABASE_URL" restore.pgc
```

The dump has no roles/ownership (`--no-owner --no-privileges`), so it restores
under whatever role you connect as. That role must be `BYPASSRLS` (or a
superuser) for the same reason the backup role is: restoring `note` rows under an
org context that does not match the row would otherwise fail the policy's
`WITH CHECK` and abort the restore. Recreate the schema first if the target is
empty (the custom-format dump includes DDL, so `pg_restore` handles it).

## Erasure survives a restore (right to be forgotten)

Deleting an account (better-auth `deleteUser`) hard-deletes the `user` row and
cascades every personal table, and `afterDelete` calls `eraseUserData`, which
removes the user's R2 objects (avatar) and writes a tombstone to
`erasures/<id>.json` in R2. The tombstone lives in R2, **outside the database
backup boundary**, precisely so a restore can re-apply it: a dump taken before an
erasure would otherwise bring the deleted person back.

After **any** restore, replay the tombstones against the restored database:

```sh
DATABASE_URL="$TARGET_DATABASE_URL" \
R2_ACCOUNT_ID=... R2_BUCKET=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
bun run db:restore-replay
```

`scripts/restore-replay.mjs` lists every `erasures/` tombstone and re-runs the
deletion (idempotent: users already absent are skipped, their avatars deleted).
This is the "beyond use" control: encrypted at rest, retention-bounded, and never
silently restored into a live system with erased people revived.

Out of scope for the repo but part of the obligation: forward erasure requests to
third-party processors (billing provider, email provider), and keep log retention
bounded (Workers Logs is 7 days; the app never logs email bodies or tokens).
