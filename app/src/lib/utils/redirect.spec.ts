import { describe, expect, it } from 'vitest';
import { safeNext } from './redirect';

describe('safeNext', () => {
	it('keeps a same-origin absolute path (with query/hash)', () => {
		expect(safeNext('/app')).toBe('/app');
		expect(safeNext('/accept-invitation/abc?x=1#y')).toBe('/accept-invitation/abc?x=1#y');
	});

	it('falls back for empty/relative input', () => {
		expect(safeNext(null)).toBe('/app');
		expect(safeNext(undefined)).toBe('/app');
		expect(safeNext('')).toBe('/app');
		expect(safeNext('relative/path')).toBe('/app');
		expect(safeNext('foo', '/home')).toBe('/home');
	});

	it('rejects every cross-origin escape a naive prefix check misses', () => {
		expect(safeNext('https://evil.example/x')).toBe('/app');
		expect(safeNext('//evil.example')).toBe('/app');
		expect(safeNext('/\\evil.example')).toBe('/app');
		expect(safeNext('/\t/evil.example')).toBe('/app');
		expect(safeNext('\thttps://evil.example')).toBe('/app');
	});
});
