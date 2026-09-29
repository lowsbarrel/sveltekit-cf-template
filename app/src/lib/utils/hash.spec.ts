import { describe, expect, it } from 'vitest';
import { fnv1a } from './hash';

describe('fnv1a', () => {
	it('is deterministic', () => {
		expect(fnv1a('hello')).toBe(fnv1a('hello'));
	});

	it('returns an unsigned 32-bit integer', () => {
		const h = fnv1a('hello');
		expect(h).toBeGreaterThanOrEqual(0);
		expect(h).toBeLessThanOrEqual(0xffffffff);
	});

	it('differs for different inputs', () => {
		expect(fnv1a('a')).not.toBe(fnv1a('b'));
	});
});
