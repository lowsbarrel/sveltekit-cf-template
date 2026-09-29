import { describe, expect, it } from 'vitest';
import { SITE } from '$lib/site';
import { absolute, seo } from './seo';

describe('absolute', () => {
	it('joins a path onto the configured origin', () => {
		expect(absolute('/pricing')).toBe(`${SITE.url}/pricing`);
	});

	it('collapses a trailing slash so one page has one canonical', () => {
		expect(absolute('/pricing/')).toBe(`${SITE.url}/pricing`);
	});

	it('keeps the root slash - `https://site/` is the conventional home canonical', () => {
		expect(absolute('/')).toBe(`${SITE.url}/`);
	});
});

describe('seo', () => {
	it('suffixes the site name, except on the home page', () => {
		expect(seo({ pathname: '/pricing', title: 'Pricing' }).title).toBe(`Pricing - ${SITE.name}`);
		expect(seo({ pathname: '/' }).title).toBe(SITE.name);
	});

	it('falls back to the site description', () => {
		expect(seo({ pathname: '/' }).description).toBe(SITE.description);
	});

	it('marks noindex pages nofollow too, so crawlers do not walk into the app', () => {
		expect(seo({ pathname: '/app', noindex: true }).robots).toBe('noindex, nofollow');
		expect(seo({ pathname: '/' }).robots).toBe('index, follow');
	});

	it('omits og:image rather than pointing it at a file that may not exist', () => {
		expect(seo({ pathname: '/', image: null }).ogImage).toBeNull();
		expect(seo({ pathname: '/', image: null }).twitterCard).toBe('summary');
	});

	it('resolves a page image to an absolute URL and upgrades the card', () => {
		const tags = seo({ pathname: '/', image: '/og.png' });
		expect(tags.ogImage).toBe(`${SITE.url}/og.png`);
		expect(tags.twitterCard).toBe('summary_large_image');
	});
});
