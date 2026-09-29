-- Owners bypass RLS unless the table FORCEs it. On Neon (and most hosted Postgres)
-- migrations run as the table owner, so `ENABLE ROW LEVEL SECURITY` alone leaves the
-- note policy inert on the default connection. FORCE makes the owner obey it too, so
-- the backstop works as long as production connects as a non-superuser role.
-- (Superusers still bypass RLS entirely; the local/test compose DB runs as `postgres`,
-- so this is a no-op there — see docs/multi-tenancy.md.)
ALTER TABLE "note" FORCE ROW LEVEL SECURITY;
