import { describe, expect, it } from 'vitest';
import { isEnabled } from '$lib/flags';
import { resolveFlags, withinRollout } from './service';

const IDS = Array.from({ length: 20_000 }, (_, i) => `user-${i}`);

const share = (key: string, rollout: number) =>
	(IDS.filter((id) => withinRollout(key, id, rollout)).length / IDS.length) * 100;

describe('withinRollout', () => {
	it('is off at 0 and on at 100', () => {
		expect(withinRollout('f', 'user-1', 0)).toBe(false);
		expect(withinRollout('f', 'user-1', 100)).toBe(true);
	});

	it('is stable for the same key and id', () => {
		expect(withinRollout('f', 'user-1', 50)).toBe(withinRollout('f', 'user-1', 50));
	});

	it.each(
		['example_flag', 'new_checkout', 'f'].flatMap((key) =>
			[5, 10, 25, 50, 90].map((rollout) => ({ key, rollout }))
		)
	)('puts $rollout% of ids in $key', ({ key, rollout }) => {
		expect(Math.abs(share(key, rollout) - rollout)).toBeLessThan(1);
	});

	it('never drops an actor when a rollout is raised', () => {
		const dropped = IDS.filter((id) => withinRollout('f', id, 10) && !withinRollout('f', id, 25));
		expect(dropped).toHaveLength(0);
	});

	it('gives different flags independent cohorts', () => {
		const inA = new Set(IDS.filter((id) => withinRollout('flag_a', id, 10)));
		const inB = IDS.filter((id) => withinRollout('flag_b', id, 10));
		const overlap = (inB.filter((id) => inA.has(id)).length / inB.length) * 100;
		expect(overlap).toBeGreaterThan(5);
		expect(overlap).toBeLessThan(15);
	});
});

describe('resolveFlags', () => {
	it('returns code defaults when no rollout applies', async () => {
		const flags = await resolveFlags({ actor: { id: 'user-1' } });
		expect(flags.example_flag).toBe(false);
	});

	it('isEnabled falls back to the flag default for a missing set', () => {
		expect(isEnabled(undefined, 'example_flag')).toBe(false);
	});
});
