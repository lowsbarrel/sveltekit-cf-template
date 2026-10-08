import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { assertUploadWithin, presignedUploadUrl, r2Configured } from './service';

const configured = {
	...env,
	R2_ACCOUNT_ID: 'acct',
	R2_BUCKET: 'files',
	R2_ACCESS_KEY_ID: 'test-key',
	R2_SECRET_ACCESS_KEY: 'test-secret'
} as Env;

describe('r2 presigning', () => {
	it('signs an upload URL scoped to exactly one key', async () => {
		const url = new URL(await presignedUploadUrl(configured, 'user-1/avatar.png'));
		expect(url.hostname).toBe('acct.r2.cloudflarestorage.com');
		expect(url.pathname).toBe('/files/user-1/avatar.png');
		expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
		expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]+$/);
	});

	it('binds the content type into the signature when given', async () => {
		const url = new URL(
			await presignedUploadUrl(configured, 'user-1/avatar.png', { contentType: 'image/png' })
		);
		expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
	});

	it('binds the declared byte length into the signature when given', async () => {
		const url = new URL(
			await presignedUploadUrl(configured, 'user-1/avatar.png', {
				contentType: 'image/png',
				contentLength: 2048
			})
		);
		expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-length');
	});

	it('refuses to sign when credentials are missing', async () => {
		await expect(presignedUploadUrl(env, 'k')).rejects.toMatchObject({ code: 'internal' });
	});

	it('rejects keys that would escape the actor prefix', async () => {
		for (const key of ['user-1/../user-2/secret.png', '../bucket/x', 'a/b?x=1', 'a#b', '/abs']) {
			await expect(presignedUploadUrl(configured, key)).rejects.toMatchObject({
				code: 'invalid'
			});
		}
	});
});

describe('r2Configured', () => {
	it('is false without the S3 credential vars and true with them', () => {
		expect(r2Configured(env)).toBe(false);
		expect(r2Configured(configured)).toBe(true);
	});
});

describe('assertUploadWithin', () => {
	const policy = { allowedTypes: ['image/png', 'image/jpeg'], maxBytes: 1000 };

	it('accepts a file inside the policy', () => {
		expect(() =>
			assertUploadWithin({ contentType: 'image/png', size: 1000 }, policy)
		).not.toThrow();
	});

	it('rejects a disallowed content type', () => {
		expect(() => assertUploadWithin({ contentType: 'application/pdf', size: 10 }, policy)).toThrow(
			AppError
		);
	});

	it('rejects a file over the byte cap', () => {
		expect(() => assertUploadWithin({ contentType: 'image/png', size: 1001 }, policy)).toThrow(
			AppError
		);
	});

	it('rejects missing type or size when the policy constrains them', () => {
		expect(() => assertUploadWithin({ size: 10 }, policy)).toThrow(AppError);
		expect(() => assertUploadWithin({ contentType: 'image/png' }, policy)).toThrow(AppError);
	});
});
