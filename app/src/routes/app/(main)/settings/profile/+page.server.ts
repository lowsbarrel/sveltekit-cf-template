import { storageConfigured } from '$lib/server/account/service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ platform }) => {
	return { uploadEnabled: platform?.env ? storageConfigured(platform.env) : false };
};
