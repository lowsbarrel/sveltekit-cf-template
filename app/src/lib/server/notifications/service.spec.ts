import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { member, organization, user } from '../db/schema';
import { createWorkerCtx, type Actor } from '../ctx';
import {
	latestNotificationId,
	listNotifications,
	markAllRead,
	markRead,
	notificationsSince,
	notify,
	notifyOrg,
	unreadCount
} from './service';

const ctx = createWorkerCtx(env);
const orgId = 'org-n';
let alice: Actor;
let bob: Actor;
let outsider: Actor;

beforeEach(async () => {
	const rows = await ctx.db
		.insert(user)
		.values([
			{ id: crypto.randomUUID(), name: 'Alice', email: 'alice@example.com' },
			{ id: crypto.randomUUID(), name: 'Bob', email: 'bob@example.com' },
			{ id: crypto.randomUUID(), name: 'Carol', email: 'carol@example.com' }
		])
		.returning();
	alice = { id: rows[0]!.id };
	bob = { id: rows[1]!.id };
	outsider = { id: rows[2]!.id };
	await ctx.db.insert(organization).values({ id: orgId, name: 'Acme', slug: 'acme' });
	await ctx.db.insert(member).values([
		{ id: crypto.randomUUID(), organizationId: orgId, userId: alice.id, role: 'owner' },
		{ id: crypto.randomUUID(), organizationId: orgId, userId: bob.id, role: 'member' }
	]);
});

describe('notify + inbox', () => {
	it('delivers a message and lists it for the recipient only', async () => {
		await notify(ctx, alice.id, { bodyKey: 'notif_note_created', params: { title: 'Hi' } });

		const forAlice = await listNotifications(ctx, alice);
		expect(forAlice).toHaveLength(1);
		expect(forAlice[0]?.bodyKey).toBe('notif_note_created');
		expect(JSON.parse(forAlice[0]!.params!)).toEqual({ title: 'Hi' });

		expect(await listNotifications(ctx, bob)).toHaveLength(0);
		expect(await unreadCount(ctx, bob)).toBe(0);
	});

	it('keeps refresh rows out of the inbox but in the stream', async () => {
		await notify(ctx, alice.id, { kind: 'refresh', params: { invalidate: 'app:notes' } });
		expect(await listNotifications(ctx, alice)).toHaveLength(0);
		expect(await notificationsSince(ctx, alice, 0)).toHaveLength(1);
	});
});

describe('notifyOrg fan-out', () => {
	it('reaches every member except the excluded actor', async () => {
		await notifyOrg(ctx, orgId, {
			bodyKey: 'notif_note_created',
			params: { title: 'x' },
			except: alice.id
		});
		expect(await listNotifications(ctx, alice)).toHaveLength(0);
		expect(await listNotifications(ctx, bob)).toHaveLength(1);
		expect(await listNotifications(ctx, outsider)).toHaveLength(0);
	});

	it('batches a fan-out larger than one insert', async () => {
		const bulkOrg = 'org-bulk';
		await ctx.db.insert(organization).values({ id: bulkOrg, name: 'Bulk', slug: 'bulk' });
		const recipients = Array.from({ length: 1001 }, (_, i) => ({
			id: crypto.randomUUID(),
			name: 'M',
			email: `m${i}@example.com`
		}));
		await ctx.db.insert(user).values(recipients);
		await ctx.db.insert(member).values(
			recipients.map((u) => ({
				id: crypto.randomUUID(),
				organizationId: bulkOrg,
				userId: u.id,
				role: 'member'
			}))
		);

		const created = await notifyOrg(ctx, bulkOrg, { bodyKey: 'notif_note_created', params: {} });

		expect(created).toHaveLength(1001);
	});
});

describe('read state and cursor', () => {
	it('tracks unread, marks read, and scopes reads to the owner', async () => {
		const n = await notify(ctx, alice.id, { bodyKey: 'notif_note_created', params: {} });
		expect(await unreadCount(ctx, alice)).toBe(1);

		await expect(markRead(ctx, bob, n!.id)).rejects.toMatchObject({ code: 'not_found' });
		expect(await unreadCount(ctx, alice)).toBe(1);

		await markRead(ctx, alice, n!.id);
		expect(await unreadCount(ctx, alice)).toBe(0);
	});

	it('markAllRead clears only the caller’s unread', async () => {
		await notify(ctx, alice.id, { bodyKey: 'notif_note_created', params: {} });
		await notify(ctx, bob.id, { bodyKey: 'notif_note_created', params: {} });
		await markAllRead(ctx, alice);
		expect(await unreadCount(ctx, alice)).toBe(0);
		expect(await unreadCount(ctx, bob)).toBe(1);
	});

	it('latestNotificationId advances with new rows', async () => {
		expect(await latestNotificationId(ctx, alice)).toBe(0);
		const n = await notify(ctx, alice.id, { bodyKey: 'notif_note_created', params: {} });
		expect(await latestNotificationId(ctx, alice)).toBe(n!.id);
		expect(await notificationsSince(ctx, alice, n!.id)).toHaveLength(0);
	});
});
