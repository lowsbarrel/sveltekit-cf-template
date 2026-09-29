import { posts } from '$lib/blog';
import { absolute } from '$lib/utils/seo';
import type { RequestHandler } from './$types';

export const prerender = true;

const ROUTES = [
	{ path: '/', changefreq: 'weekly', priority: '1.0' },
	{ path: '/pricing', changefreq: 'monthly', priority: '0.8' },
	{ path: '/blog', changefreq: 'weekly', priority: '0.7' },
	{ path: '/terms', changefreq: 'yearly', priority: '0.3' },
	{ path: '/privacy', changefreq: 'yearly', priority: '0.3' },
	{ path: '/cookies', changefreq: 'yearly', priority: '0.3' }
];

export const GET: RequestHandler = () => {
	const postRoutes = posts.map((post) => ({
		path: `/blog/${post.slug}`,
		changefreq: 'yearly',
		priority: '0.6'
	}));

	const urls = [...ROUTES, ...postRoutes]
		.map(
			({ path, changefreq, priority }) =>
				`	<url>
		<loc>${absolute(path)}</loc>
		<changefreq>${changefreq}</changefreq>
		<priority>${priority}</priority>
	</url>`
		)
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

	return new Response(body, {
		headers: { 'content-type': 'application/xml; charset=utf-8' }
	});
};
