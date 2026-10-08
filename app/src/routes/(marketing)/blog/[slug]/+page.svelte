<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { formatDate } from '$lib/blog';
	import * as m from '$lib/paraglide/messages';
	import { articleJsonLd } from '$lib/utils/seo';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	title={data.post.title}
	description={data.post.description}
	type="article"
	jsonLd={[
		articleJsonLd({
			title: data.post.title,
			description: data.post.description,
			path: page.url.pathname,
			date: data.post.date,
			author: data.post.author
		})
	]}
/>

<article class="mx-auto max-w-2xl px-6 py-16">
	<a href={resolve('/blog')} class="text-sm font-medium text-link hover:text-link/80">
		← {m.blog_all_posts()}
	</a>

	<header class="mt-6 space-y-3">
		<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{data.post.title}</h1>
		<div class="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
			<time datetime={data.post.date}>{formatDate(data.post.date)}</time>
			{#if data.post.author}<span>· {data.post.author}</span>{/if}
			{#if data.post.category}
				<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
					{data.post.category}
				</span>
			{/if}
		</div>
	</header>

	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class="prose mt-10">{@html data.post.html}</div>
</article>
