import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('GET /api/health', () => {
	it('responds with ok', async () => {
		const response = await GET({ platform: undefined } as unknown as Parameters<typeof GET>[0]);
		expect(await response.json()).toEqual({ status: 'ok', runtime: 'local' });
	});
});
