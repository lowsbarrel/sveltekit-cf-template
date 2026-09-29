import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';
import { INBOX_LIMIT, type NotifBodyKey, type NotifKind } from '$lib/notifications';
import { member, notification } from '../db/schema';
import { AppError } from '../errors';
import type { Actor, Ctx } from '../ctx';

export type NotifyInput = {
	kind?: NotifKind;
	bodyKey?: NotifBodyKey;
	params?: Record<string, unknown>;
	href?: string;
};

function row(userId: string, input: NotifyInput) {
	return {
		userId,
		kind: input.kind ?? 'message',
		bodyKey: input.bodyKey ?? null,
		params: input.params ? JSON.stringify(input.params) : null,
		href: input.href ?? null
	};
}

export async function notify(ctx: Ctx, userId: string, input: NotifyInput) {
	const [created] = await ctx.db.insert(notification).values(row(userId, input)).returning();
	return created;
}

export async function notifyOrg(ctx: Ctx, orgId: string, input: NotifyInput & { except?: string }) {
	const members = await ctx.db
		.select({ userId: member.userId })
		.from(member)
		.where(eq(member.organizationId, orgId));
	const targets = members.map((m) => m.userId).filter((id) => id !== input.except);
	if (!targets.length) return [];
	return ctx.db
		.insert(notification)
		.values(targets.map((userId) => row(userId, input)))
		.returning();
}

export async function listNotifications(ctx: Ctx, actor: Actor, limit = INBOX_LIMIT) {
	return ctx.db
		.select()
		.from(notification)
		.where(and(eq(notification.userId, actor.id), eq(notification.kind, 'message')))
		.orderBy(desc(notification.id))
		.limit(limit);
}

export async function latestNotificationId(ctx: Ctx, actor: Actor): Promise<number> {
	const [found] = await ctx.db
		.select({ id: notification.id })
		.from(notification)
		.where(eq(notification.userId, actor.id))
		.orderBy(desc(notification.id))
		.limit(1);
	return found?.id ?? 0;
}

export async function notificationsSince(ctx: Ctx, actor: Actor, sinceId: number) {
	return ctx.db
		.select()
		.from(notification)
		.where(and(eq(notification.userId, actor.id), gt(notification.id, sinceId)))
		.orderBy(notification.id)
		.limit(INBOX_LIMIT);
}

export async function unreadCount(ctx: Ctx, actor: Actor): Promise<number> {
	const [found] = await ctx.db
		.select({ n: count() })
		.from(notification)
		.where(
			and(
				eq(notification.userId, actor.id),
				eq(notification.kind, 'message'),
				isNull(notification.readAt)
			)
		);
	return found?.n ?? 0;
}

export async function markRead(ctx: Ctx, actor: Actor, id: number) {
	const [updated] = await ctx.db
		.update(notification)
		.set({ readAt: new Date() })
		.where(and(eq(notification.id, id), eq(notification.userId, actor.id)))
		.returning();
	if (!updated) throw new AppError('not_found', 'Notification not found');
	return updated;
}

export async function markAllRead(ctx: Ctx, actor: Actor) {
	await ctx.db
		.update(notification)
		.set({ readAt: new Date() })
		.where(and(eq(notification.userId, actor.id), isNull(notification.readAt)));
}
