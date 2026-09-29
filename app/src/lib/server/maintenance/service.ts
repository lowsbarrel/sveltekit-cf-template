import { lt } from 'drizzle-orm';
import { session, verification } from '../db/schema';
import type { Ctx } from '../ctx';

export async function purgeExpired(ctx: Ctx, now = new Date()) {
	const [sessions, verifications] = await Promise.all([
		ctx.db.delete(session).where(lt(session.expiresAt, now)).returning({ id: session.id }),
		ctx.db
			.delete(verification)
			.where(lt(verification.expiresAt, now))
			.returning({ id: verification.id })
	]);
	return { sessions: sessions.length, verifications: verifications.length };
}
