import { FLAGS, defaultFlags, flagKeys, type FlagDefinition, type Flags } from '$lib/flags';
import { fnv1a } from '$lib/utils/hash';

export type FlagContext = {
	actor?: { id: string } | null;
	env?: Env;
};

export interface FlagProvider {
	resolve(context: FlagContext): Flags | Promise<Flags>;
}

export function withinRollout(key: string, id: string, rollout: number): boolean {
	if (rollout <= 0) return false;
	if (rollout >= 100) return true;
	return fnv1a(`${key}:${id}`) % 100 < rollout;
}

export const staticFlagProvider: FlagProvider = {
	resolve({ actor }) {
		const flags = { ...defaultFlags };
		for (const key of flagKeys) {
			const def: FlagDefinition = FLAGS[key];
			if (typeof def.rollout === 'number' && actor) {
				flags[key] = withinRollout(key, actor.id, def.rollout);
			}
		}
		return flags;
	}
};

export function flagProvider(): FlagProvider {
	return staticFlagProvider;
}

export function resolveFlags(context: FlagContext): Flags | Promise<Flags> {
	return flagProvider().resolve(context);
}
