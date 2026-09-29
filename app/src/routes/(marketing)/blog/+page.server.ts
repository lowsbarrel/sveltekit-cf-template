import { categories, posts } from '$lib/blog';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => {
	return {
		posts: posts.map((post) => ({
			slug: post.slug,
			title: post.title,
			description: post.description,
			date: post.date,
			author: post.author,
			category: post.category
		})),
		categories: categories()
	};
};
