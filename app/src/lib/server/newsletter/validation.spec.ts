import { describe, expect, it } from 'vitest';
import { subscribeSchema } from './service';

describe('subscribeSchema', () => {
	it('trims and lowercases the email', () => {
		const parsed = subscribeSchema.parse({ email: '  Reader@Example.COM ' });
		expect(parsed.email).toBe('reader@example.com');
	});

	it('rejects malformed addresses', () => {
		expect(subscribeSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
		expect(subscribeSchema.safeParse({ email: '' }).success).toBe(false);
	});

	it('rejects addresses longer than 254 chars', () => {
		const long = `${'a'.repeat(250)}@x.com`;
		expect(subscribeSchema.safeParse({ email: long }).success).toBe(false);
	});
});
