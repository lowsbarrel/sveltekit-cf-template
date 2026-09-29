import { SITE } from '$lib/site';

export type SeoInput = {
	title?: string;
	description?: string;
	pathname: string;
	noindex?: boolean;
	image?: string | null;
	type?: 'website' | 'article';
};

export type SeoTags = {
	title: string;
	description: string;
	canonical: string;
	robots: string;
	ogTitle: string;
	ogType: string;
	ogUrl: string;
	ogImage: string | null;
	twitterCard: 'summary' | 'summary_large_image';
	twitterCreator: string | null;
};

export function absolute(pathname: string): string {
	const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
	const clean = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
	return `${SITE.url}${clean}`;
}

export function seo(input: SeoInput): SeoTags {
	const title = input.title ? `${input.title} - ${SITE.name}` : SITE.name;
	const description = input.description ?? SITE.description;
	const canonical = absolute(input.pathname);
	const image = input.image === undefined ? SITE.ogImage : input.image;

	return {
		title,
		description,
		canonical,
		robots: input.noindex ? 'noindex, nofollow' : 'index, follow',
		ogTitle: title,
		ogType: input.type ?? 'website',
		ogUrl: canonical,
		ogImage: image ? absolute(image) : null,
		twitterCard: image ? 'summary_large_image' : 'summary',
		twitterCreator: SITE.twitter ? `@${SITE.twitter}` : null
	};
}

export function websiteJsonLd() {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE.name,
		url: SITE.url,
		description: SITE.description
	};
}

export function articleJsonLd(input: {
	title: string;
	description: string;
	path: string;
	date: string;
	author?: string;
}) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		headline: input.title,
		description: input.description,
		datePublished: input.date,
		url: absolute(input.path),
		...(input.author ? { author: { '@type': 'Person', name: input.author } } : {}),
		publisher: { '@type': 'Organization', name: SITE.name }
	};
}

export function organizationJsonLd() {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: SITE.name,
		url: SITE.url,
		...(SITE.ogImage ? { logo: absolute(SITE.ogImage) } : {})
	};
}
