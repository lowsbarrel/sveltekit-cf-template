import { SITE } from '$lib/site';
import type { RequestHandler } from './$types';

export const prerender = true;

const DISALLOW = [
	'/app',
	'/login',
	'/signup',
	'/magic-link',
	'/verify-email',
	'/forgot-password',
	'/reset-password',
	'/api'
];

export const GET: RequestHandler = () => {
	const body = [
		'User-agent: *',
		...DISALLOW.map((path) => `Disallow: ${path}`),
		'',
		`Sitemap: ${SITE.url}/sitemap.xml`,
		''
	].join('\n');

	return new Response(body, {
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
};
