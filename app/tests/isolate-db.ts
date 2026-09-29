import { env } from 'cloudflare:workers';
import { beforeEach } from 'vitest';
import postgres from 'postgres';

beforeEach(async () => {
	const sql = postgres(env.HYPERDRIVE.connectionString, { max: 1, fetch_types: false });
	try {
		await sql`TRUNCATE "user", "session", "account", "verification", "organization", "member", "invitation", "rate_limit", "subscription", "purchase", "webhook_event", "todo", "note", "newsletter_subscriber", "two_factor", "passkey", "notification" RESTART IDENTITY CASCADE`;
	} finally {
		await sql.end();
	}
});
