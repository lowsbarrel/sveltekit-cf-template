<script lang="ts">
	import { page } from '$app/state';
	import { seo, type SeoInput } from '$lib/utils/seo';

	type Props = Omit<SeoInput, 'pathname'> & {
		jsonLd?: unknown[];
	};

	let { jsonLd = [], ...input }: Props = $props();

	const tags = $derived(seo({ ...input, pathname: page.url.pathname }));

	const OPEN = '<script type="application/ld+json">';
	const CLOSE = '</' + 'script>';

	const ldJsonTags = $derived(
		jsonLd.map((data) => OPEN + JSON.stringify(data).replace(/</g, '\\u003c') + CLOSE)
	);
</script>

<svelte:head>
	<title>{tags.title}</title>
	<meta name="description" content={tags.description} />
	<meta name="robots" content={tags.robots} />
	<link rel="canonical" href={tags.canonical} />

	<meta property="og:title" content={tags.ogTitle} />
	<meta property="og:description" content={tags.description} />
	<meta property="og:type" content={tags.ogType} />
	<meta property="og:url" content={tags.ogUrl} />
	{#if tags.ogImage}
		<meta property="og:image" content={tags.ogImage} />
	{/if}

	<meta name="twitter:card" content={tags.twitterCard} />
	{#if tags.twitterCreator}
		<meta name="twitter:creator" content={tags.twitterCreator} />
	{/if}

	{#each ldJsonTags as tag, i (i)}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- ld+json must be a script tag; the payload is developer-authored and `<` is escaped above -->
		{@html tag}
	{/each}
</svelte:head>
