import { createAuthClient } from 'better-auth/svelte';
import { magicLinkClient, organizationClient, twoFactorClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import { ac, roles } from '$lib/permissions';

export const authClient = createAuthClient({
	plugins: [
		organizationClient({ ac, roles }),
		magicLinkClient(),
		twoFactorClient(),
		passkeyClient()
	]
});
