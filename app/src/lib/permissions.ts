import { createAccessControl } from 'better-auth/plugins/access';
import {
	adminAc,
	defaultStatements,
	memberAc,
	ownerAc
} from 'better-auth/plugins/organization/access';

export const statement = {
	...defaultStatements,
	billing: ['read', 'manage'],
	todo: ['create', 'update', 'delete'],
	note: ['create', 'update', 'delete']
} as const;

export const ac = createAccessControl(statement);

export const roles = {
	member: ac.newRole({
		billing: ['read'],
		todo: ['create', 'update'],
		note: ['create', 'update'],
		...memberAc.statements
	}),
	admin: ac.newRole({
		billing: ['read', 'manage'],
		todo: ['create', 'update', 'delete'],
		note: ['create', 'update', 'delete'],
		...adminAc.statements
	}),
	owner: ac.newRole({
		billing: ['read', 'manage'],
		todo: ['create', 'update', 'delete'],
		note: ['create', 'update', 'delete'],
		...ownerAc.statements
	})
};

export type OrgRole = keyof typeof roles;

export type PermissionRequest = {
	[K in keyof typeof statement]?: (typeof statement)[K][number][];
};

export function can(role: string, request: PermissionRequest): boolean {
	const r = roles[role as OrgRole];
	return r ? r.authorize(request as never).success : false;
}
