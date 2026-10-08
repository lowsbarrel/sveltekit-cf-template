import { and, eq, gt } from 'drizzle-orm';
import { can, type PermissionRequest } from '$lib/permissions';
import { invitation, member, organization, session, user } from '../db/schema';
import { AppError } from '../errors';
import type { Actor, Ctx } from '../ctx';

export async function requireMember(ctx: Ctx, actor: Actor, orgId: string) {
	const [found] = await ctx.db
		.select()
		.from(member)
		.where(and(eq(member.organizationId, orgId), eq(member.userId, actor.id)));
	if (!found) throw new AppError('forbidden', 'Not a member of this organization');
	return found;
}

export async function requirePermission(
	ctx: Ctx,
	actor: Actor,
	orgId: string,
	request: PermissionRequest
) {
	const found = await requireMember(ctx, actor, orgId);
	if (!can(found.role, request)) {
		throw new AppError('forbidden', 'Missing permission for this action');
	}
	return found;
}

export async function orgContext(ctx: Ctx, actor: Actor, orgId: string) {
	const membership = await requireMember(ctx, actor, orgId);
	const [org] = await ctx.db.select().from(organization).where(eq(organization.id, orgId));
	if (!org) throw new AppError('not_found', 'Organization not found');
	return { id: org.id, name: org.name, slug: org.slug, role: membership.role };
}

export async function listUserOrgs(ctx: Ctx, actor: Actor) {
	return ctx.db
		.select({ id: organization.id, name: organization.name, role: member.role })
		.from(member)
		.innerJoin(organization, eq(member.organizationId, organization.id))
		.where(eq(member.userId, actor.id))
		.orderBy(organization.name);
}

export async function setActiveOrganization(ctx: Ctx, sessionId: string, orgId: string) {
	await ctx.db
		.update(session)
		.set({ activeOrganizationId: orgId })
		.where(eq(session.id, sessionId));
}

export async function listTeam(ctx: Ctx, actor: Actor, orgId: string) {
	await requireMember(ctx, actor, orgId);
	const [members, invites] = await Promise.all([
		ctx.db
			.select({
				memberId: member.id,
				userId: member.userId,
				role: member.role,
				name: user.name,
				email: user.email,
				image: user.image,
				joinedAt: member.createdAt
			})
			.from(member)
			.innerJoin(user, eq(member.userId, user.id))
			.where(eq(member.organizationId, orgId))
			.orderBy(member.createdAt),
		ctx.db
			.select({
				id: invitation.id,
				email: invitation.email,
				role: invitation.role,
				expiresAt: invitation.expiresAt
			})
			.from(invitation)
			.where(
				and(
					eq(invitation.organizationId, orgId),
					eq(invitation.status, 'pending'),
					gt(invitation.expiresAt, new Date())
				)
			)
	]);
	return { members, invites };
}

export async function getInvitationPreview(ctx: Ctx, id: string) {
	const [row] = await ctx.db
		.select({
			id: invitation.id,
			orgId: invitation.organizationId,
			email: invitation.email,
			role: invitation.role,
			status: invitation.status,
			expiresAt: invitation.expiresAt,
			orgName: organization.name,
			inviterName: user.name
		})
		.from(invitation)
		.innerJoin(organization, eq(invitation.organizationId, organization.id))
		.innerJoin(user, eq(invitation.inviterId, user.id))
		.where(eq(invitation.id, id));
	if (!row || row.status !== 'pending' || row.expiresAt.getTime() < Date.now()) return null;
	return row;
}

export async function renameOrganization(ctx: Ctx, actor: Actor, orgId: string, name: string) {
	await requirePermission(ctx, actor, orgId, { organization: ['update'] });
	const [updated] = await ctx.db
		.update(organization)
		.set({ name })
		.where(eq(organization.id, orgId))
		.returning();
	if (!updated) throw new AppError('not_found', 'Organization not found');
	return updated;
}
