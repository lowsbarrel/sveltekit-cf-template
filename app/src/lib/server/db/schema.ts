import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	index,
	integer,
	pgPolicy,
	pgTable,
	text,
	timestamp
} from 'drizzle-orm/pg-core';

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdateFn(() => new Date())
};

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	locale: text('locale').notNull().default('en'),
	onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
	twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
	...timestamps
});

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		token: text('token').notNull().unique(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		activeOrganizationId: text('active_organization_id'),
		...timestamps
	},
	(t) => [index('session_user_id_idx').on(t.userId)]
);

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: text('scope'),
		password: text('password'),
		...timestamps
	},
	(t) => [index('account_user_id_idx').on(t.userId)]
);

export const organization = pgTable('organization', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	logo: text('logo'),
	metadata: text('metadata'),
	...timestamps
});

export const member = pgTable(
	'member',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role').notNull().default('member'),
		...timestamps
	},
	(t) => [
		index('member_organization_id_user_id_idx').on(t.organizationId, t.userId),
		index('member_user_id_idx').on(t.userId)
	]
);

export const invitation = pgTable(
	'invitation',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		role: text('role').notNull().default('member'),
		status: text('status').notNull().default('pending'),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		inviterId: text('inviter_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		...timestamps
	},
	(t) => [index('invitation_organization_id_status_idx').on(t.organizationId, t.status)]
);

export const rateLimit = pgTable(
	'rate_limit',
	{
		id: text('id').primaryKey(),
		key: text('key').notNull(),
		count: integer('count').notNull(),
		lastRequest: bigint('last_request', { mode: 'number' }).notNull()
	},
	(t) => [index('rate_limit_key_idx').on(t.key)]
);

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		...timestamps
	},
	(t) => [index('verification_identifier_idx').on(t.identifier)]
);

export const subscription = pgTable('subscription', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id')
		.notNull()
		.unique()
		.references(() => organization.id, { onDelete: 'cascade' }),
	creemCustomerId: text('creem_customer_id').notNull(),
	creemSubscriptionId: text('creem_subscription_id').notNull().unique(),
	creemProductId: text('creem_product_id').notNull(),
	status: text('status').notNull(),
	currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
	lastEventAt: timestamp('last_event_at', { withTimezone: true }).notNull(),
	...timestamps
});

export const webhookEvent = pgTable(
	'webhook_event',
	{
		id: text('id').primaryKey(),
		provider: text('provider').notNull(),
		eventType: text('event_type').notNull(),
		receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('webhook_event_provider_received_at_idx').on(t.provider, t.receivedAt)]
);

export type Subscription = typeof subscription.$inferSelect;

export const purchase = pgTable(
	'purchase',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		creemOrderId: text('creem_order_id').notNull().unique(),
		creemCustomerId: text('creem_customer_id').notNull(),
		creemProductId: text('creem_product_id').notNull(),
		status: text('status').notNull(),
		purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull(),
		...timestamps
	},
	(t) => [index('purchase_organization_id_idx').on(t.organizationId)]
);

export type Purchase = typeof purchase.$inferSelect;

export const todo = pgTable(
	'todo',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		title: text('title').notNull(),
		done: boolean('done').notNull().default(false),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		...timestamps
	},
	(t) => [index('todo_user_id_idx').on(t.userId)]
);

export type Todo = typeof todo.$inferSelect;

export const note = pgTable(
	'note',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		body: text('body').notNull().default(''),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		...timestamps
	},
	(t) => [
		index('note_organization_id_idx').on(t.organizationId),
		pgPolicy('note_tenant_isolation', {
			as: 'permissive',
			for: 'all',
			to: 'public',
			using: sql`organization_id = current_setting('app.current_org_id', true)`,
			withCheck: sql`organization_id = current_setting('app.current_org_id', true)`
		})
	]
);

export type Note = typeof note.$inferSelect;

export const newsletterStatus = ['pending', 'confirmed', 'unsubscribed'] as const;

export const newsletterSubscriber = pgTable(
	'newsletter_subscriber',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		email: text('email').notNull().unique(),
		status: text('status', { enum: newsletterStatus }).notNull().default('pending'),
		confirmTokenHash: text('confirm_token_hash'),
		confirmTokenExpiresAt: timestamp('confirm_token_expires_at', { withTimezone: true }),
		confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
		unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [index('newsletter_subscriber_confirm_token_hash_idx').on(t.confirmTokenHash)]
);

export type NewsletterSubscriber = typeof newsletterSubscriber.$inferSelect;

// better-auth plugin tables: property names must match the plugin field names, not our conventions.
export const twoFactor = pgTable(
	'two_factor',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		secret: text('secret').notNull(),
		backupCodes: text('backup_codes').notNull(),
		verified: boolean('verified').notNull().default(true),
		failedVerificationCount: integer('failed_verification_count').notNull().default(0),
		lockedUntil: timestamp('locked_until', { withTimezone: true })
	},
	(t) => [index('two_factor_user_id_idx').on(t.userId)]
);

export const passkey = pgTable(
	'passkey',
	{
		id: text('id').primaryKey(),
		name: text('name'),
		publicKey: text('public_key').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		credentialID: text('credential_id').notNull(),
		counter: integer('counter').notNull(),
		deviceType: text('device_type').notNull(),
		backedUp: boolean('backed_up').notNull(),
		transports: text('transports'),
		aaguid: text('aaguid'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('passkey_user_id_idx').on(t.userId),
		index('passkey_credential_id_idx').on(t.credentialID)
	]
);

export const notification = pgTable(
	'notification',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull().default('message'),
		bodyKey: text('body_key'),
		params: text('params'),
		href: text('href'),
		readAt: timestamp('read_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [index('notification_user_id_id_idx').on(t.userId, t.id)]
);

export type Notification = typeof notification.$inferSelect;
