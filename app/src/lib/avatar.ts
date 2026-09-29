export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export function isAllowedAvatar(file: { type: string; size: number }): boolean {
	return (AVATAR_TYPES as readonly string[]).includes(file.type) && file.size <= AVATAR_MAX_BYTES;
}
