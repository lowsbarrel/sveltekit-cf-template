import { error } from '@sveltejs/kit';

export type AppErrorCode =
	| 'unauthorized'
	| 'forbidden'
	| 'not_found'
	| 'conflict'
	| 'invalid'
	| 'rate_limited'
	| 'limit_reached'
	| 'internal';

const STATUS: Record<AppErrorCode, number> = {
	unauthorized: 401,
	forbidden: 403,
	not_found: 404,
	conflict: 409,
	invalid: 400,
	rate_limited: 429,
	limit_reached: 402,
	internal: 500
};

export class AppError extends Error {
	readonly code: AppErrorCode;
	readonly status: number;

	constructor(code: AppErrorCode, message: string) {
		super(message);
		this.code = code;
		this.status = STATUS[code];
	}
}

export function httpError(e: unknown): never {
	if (e instanceof AppError) error(e.status, { message: e.message, code: e.code });
	throw e;
}
