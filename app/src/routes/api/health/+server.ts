import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ platform }) => {
	return json({
		status: 'ok',
		runtime: platform?.cf ? 'cloudflare' : 'local'
	});
};
