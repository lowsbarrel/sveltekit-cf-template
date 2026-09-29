import { AppError } from '../errors';
import { requireMember } from '../orgs/service';
import type { Actor, Ctx } from '../ctx';

const enc = new TextEncoder();
const TOKEN_TTL_S = 60;

export type RealtimeClaims = { sub: string; room: string; exp: number };

function b64url(bytes: ArrayBuffer | Uint8Array): string {
	const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let s = '';
	for (const byte of b) s += String.fromCharCode(byte);
	return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
	const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/'));
	const out = new Uint8Array(new ArrayBuffer(bin.length));
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

function hmacKey(secret: string) {
	return crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

export async function mintRealtimeToken(
	ctx: Ctx,
	env: Env,
	actor: Actor,
	orgId: string,
	room: string
) {
	if (!env.REALTIME_SECRET) throw new AppError('internal', 'REALTIME_SECRET is not set');
	await requireMember(ctx, actor, orgId);

	const claims: RealtimeClaims = {
		sub: actor.id,
		room: `${orgId}:${room}`,
		exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S
	};
	const payload = b64url(enc.encode(JSON.stringify(claims)));
	const sig = await crypto.subtle.sign(
		'HMAC',
		await hmacKey(env.REALTIME_SECRET),
		enc.encode(payload)
	);
	return {
		token: `${payload}.${b64url(sig)}`,
		url: env.PUBLIC_REALTIME_URL ?? null,
		room: claims.room
	};
}

export async function verifyRealtimeToken(
	secret: string,
	token: string
): Promise<RealtimeClaims | null> {
	const dot = token.indexOf('.');
	if (dot < 1) return null;
	const payload = token.slice(0, dot);
	const sig = token.slice(dot + 1);

	let ok: boolean;
	try {
		ok = await crypto.subtle.verify(
			'HMAC',
			await hmacKey(secret),
			fromB64url(sig),
			enc.encode(payload)
		);
	} catch {
		return null;
	}
	if (!ok) return null;

	try {
		const claims = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as RealtimeClaims;
		if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null;
		if (typeof claims.sub !== 'string' || typeof claims.room !== 'string') return null;
		return claims;
	} catch {
		return null;
	}
}
