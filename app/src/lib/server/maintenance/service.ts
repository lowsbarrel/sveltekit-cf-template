import { lt } from 'drizzle-orm';
import { notification, session, verification, webhookEvent } from '../db/schema';
import type { Ctx } from '../ctx';

const DAY = 86_400_000;
const NOTIFICATION_RETENTION_DAYS = 90;
const WEBHOOK_EVENT_RETENTION_DAYS = 30;

export async function purgeExpired(ctx: Ctx, now = new Date()) {
	const notificationsBefore = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * DAY);
	const webhooksBefore = new Date(now.getTime() - WEBHOOK_EVENT_RETENTION_DAYS * DAY);
	const [sessions, verifications, notifications, webhookEvents] = await Promise.all([
		ctx.db.delete(session).where(lt(session.expiresAt, now)),
		ctx.db.delete(verification).where(lt(verification.expiresAt, now)),
		ctx.db.delete(notification).where(lt(notification.createdAt, notificationsBefore)),
		ctx.db.delete(webhookEvent).where(lt(webhookEvent.receivedAt, webhooksBefore))
	]);
	return {
		sessions: sessions.count,
		verifications: verifications.count,
		notifications: notifications.count,
		webhookEvents: webhookEvents.count
	};
}
