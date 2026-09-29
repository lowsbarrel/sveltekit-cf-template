export type FlagDefinition = {
	description: string;
	default: boolean;
	// 0-100, not 0-1.
	rollout?: number;
};

export const FLAGS = {
	example_flag: {
		description: 'Reference flag - delete when you add your first real one.',
		default: false
	}
} as const satisfies Record<string, FlagDefinition>;

export type FlagKey = keyof typeof FLAGS;

export type Flags = Record<FlagKey, boolean>;

export const flagKeys = Object.keys(FLAGS) as FlagKey[];

export const defaultFlags: Flags = Object.fromEntries(
	flagKeys.map((key) => [key, FLAGS[key].default])
) as Flags;

export function isEnabled(flags: Flags | undefined, key: FlagKey): boolean {
	return flags?.[key] ?? FLAGS[key].default;
}
