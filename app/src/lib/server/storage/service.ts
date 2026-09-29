import { AwsClient } from 'aws4fetch';
import { AppError } from '../errors';

export type UploadPolicy = {
	allowedTypes?: readonly string[];
	maxBytes?: number;
};

function r2(env: Env) {
	if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ACCOUNT_ID || !env.R2_BUCKET) {
		throw new AppError('internal', 'R2 presigning is not configured (R2_* secrets and vars)');
	}
	return {
		aws: new AwsClient({
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
			service: 's3',
			region: 'auto'
		}),
		base: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`
	};
}

function assertSafeKey(key: string): void {
	const invalid =
		key.length === 0 ||
		key.length > 1024 ||
		key.startsWith('/') ||
		/[?#\\]/.test(key) ||
		// eslint-disable-next-line no-control-regex
		/[\x00-\x1f]/.test(key) ||
		key.split('/').some((seg) => seg === '' || seg === '.' || seg === '..');
	if (invalid) throw new AppError('invalid', 'Invalid storage key');
}

export function assertUploadWithin(
	file: { contentType?: string | null; size?: number | null },
	{ allowedTypes, maxBytes }: UploadPolicy
): void {
	if (allowedTypes && (!file.contentType || !allowedTypes.includes(file.contentType))) {
		throw new AppError('invalid', 'Unsupported file type');
	}
	if (maxBytes != null && (file.size == null || file.size > maxBytes)) {
		throw new AppError('invalid', 'File is too large');
	}
}

async function presign(env: Env, method: 'GET' | 'PUT', key: string, expiresIn: number) {
	assertSafeKey(key);
	const { aws, base } = r2(env);
	const url = new URL(`${base}/${key}`);
	url.searchParams.set('X-Amz-Expires', String(expiresIn));
	const signed = await aws.sign(new Request(url, { method }), { aws: { signQuery: true } });
	return signed.url;
}

export async function presignedUploadUrl(
	env: Env,
	key: string,
	{ contentType, expiresIn = 600 }: { contentType?: string; expiresIn?: number } = {}
) {
	if (!contentType) return presign(env, 'PUT', key, expiresIn);
	assertSafeKey(key);
	const { aws, base } = r2(env);
	const url = new URL(`${base}/${key}`);
	url.searchParams.set('X-Amz-Expires', String(expiresIn));
	const signed = await aws.sign(
		new Request(url, { method: 'PUT', headers: { 'content-type': contentType } }),
		{
			aws: { signQuery: true, allHeaders: true }
		}
	);
	return signed.url;
}

export function presignedDownloadUrl(env: Env, key: string, { expiresIn = 3600 } = {}) {
	return presign(env, 'GET', key, expiresIn);
}

export async function uploadedObjectMeta(
	env: Env,
	key: string
): Promise<{ size: number; contentType: string | null; etag: string | null } | null> {
	assertSafeKey(key);
	const { aws, base } = r2(env);
	const res = await aws.fetch(new Request(`${base}/${key}`, { method: 'HEAD' }));
	if (res.status === 404) return null;
	if (!res.ok) throw new AppError('internal', `R2 HEAD failed (${res.status})`);
	const length = res.headers.get('content-length');
	return {
		size: length ? Number(length) : 0,
		contentType: res.headers.get('content-type'),
		etag: res.headers.get('etag')?.replace(/"/g, '') ?? null
	};
}

export async function putObject(
	env: Env,
	key: string,
	body: string,
	{ contentType }: { contentType?: string } = {}
): Promise<void> {
	assertSafeKey(key);
	const { aws, base } = r2(env);
	const res = await aws.fetch(
		new Request(`${base}/${key}`, {
			method: 'PUT',
			body,
			headers: contentType ? { 'content-type': contentType } : {}
		})
	);
	if (!res.ok) throw new AppError('internal', `R2 PUT failed (${res.status})`);
}

export async function deleteObject(env: Env, key: string): Promise<void> {
	assertSafeKey(key);
	const { aws, base } = r2(env);
	const res = await aws.fetch(new Request(`${base}/${key}`, { method: 'DELETE' }));
	if (!res.ok && res.status !== 404)
		throw new AppError('internal', `R2 DELETE failed (${res.status})`);
}

export function r2Configured(env: Env): boolean {
	return (
		!!env.R2_ACCESS_KEY_ID && !!env.R2_SECRET_ACCESS_KEY && !!env.R2_ACCOUNT_ID && !!env.R2_BUCKET
	);
}
