import { error } from '@sveltejs/kit';
import { getPost, posts } from '$lib/blog';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => posts.map((post) => ({ slug: post.slug }));

export const load: PageServerLoad = ({ params }) => {
	const post = getPost(params.slug);
	if (!post) error(404, { message: 'Post not found', code: 'not_found' });
	return { post };
};
