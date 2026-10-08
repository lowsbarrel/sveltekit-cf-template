import { dev } from '$app/environment';
import { marked } from 'marked';

export type PostMeta = {
	slug: string;
	title: string;
	description: string;
	date: string;
	author?: string;
	category?: string;
	draft: boolean;
};

export type Post = PostMeta & { html: string };

const files = import.meta.glob('/src/content/blog/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
	if (!match) return { data: {}, body: raw };
	const data: Record<string, string> = {};
	for (const line of match[1]!.split(/\r?\n/)) {
		const i = line.indexOf(':');
		if (i === -1) continue;
		const key = line.slice(0, i).trim();
		let value = line.slice(i + 1).trim();
		const quoted = value.length >= 2 && (value[0] === '"' || value[0] === "'");
		if (quoted && value[value.length - 1] === value[0]) value = value.slice(1, -1);
		data[key] = value;
	}
	return { data, body: match[2] ?? '' };
}

function toPost(path: string, raw: string): Post {
	const slug = path.split('/').pop()!.replace(/\.md$/, '');
	const { data, body } = parseFrontmatter(raw);
	return {
		slug,
		title: data.title ?? slug,
		description: data.description ?? '',
		date: data.date ?? '1970-01-01',
		author: data.author || undefined,
		category: data.category || undefined,
		draft: data.draft === 'true',
		html: marked.parse(body, { async: false })
	};
}

const ALL: Post[] = Object.entries(files)
	.map(([path, raw]) => toPost(path, raw))
	.sort((a, b) => (a.date < b.date ? 1 : -1));

export const posts: Post[] = ALL.filter((post) => dev || !post.draft);

export function getPost(slug: string): Post | undefined {
	return posts.find((post) => post.slug === slug);
}

export function categories(): string[] {
	return [...new Set(posts.map((post) => post.category).filter((c): c is string => !!c))];
}

export function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}
