<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { formatDate } from '$lib/blog';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let selected = $state<string | null>(null);
	const visible = $derived(
		selected ? data.posts.filter((post) => post.category === selected) : data.posts
	);
</script>

<Seo title={m.blog_title()} description={m.blog_meta_description()} />

<section class="mx-auto max-w-3xl px-6 py-16 sm:py-20">
	<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{m.blog_title()}</h1>
	<p class="mt-4 text-muted-foreground">{m.blog_subtitle()}</p>

	{#if data.categories.length > 0}
		<div class="mt-8 flex flex-wrap gap-2">
			<button
				onclick={() => (selected = null)}
				class="rounded-full px-3 py-1 text-sm font-medium {selected === null
					? 'bg-foreground text-background'
					: 'bg-muted text-muted-foreground hover:bg-muted/70'}"
			>
				{m.blog_all_categories()}
			</button>
			{#each data.categories as cat (cat)}
				<button
					onclick={() => (selected = cat)}
					class="rounded-full px-3 py-1 text-sm font-medium {selected === cat
						? 'bg-foreground text-background'
						: 'bg-muted text-muted-foreground hover:bg-muted/70'}"
				>
					{cat}
				</button>
			{/each}
		</div>
	{/if}

	{#if visible.length === 0}
		<p class="mt-12 text-muted-foreground">{m.blog_empty()}</p>
	{:else}
		<ul class="mt-12 space-y-10">
			{#each visible as post (post.slug)}
				<li>
					<article class="space-y-2">
						<a href={resolve(`/blog/${post.slug}`)} class="group block">
							<h2 class="text-xl font-semibold group-hover:text-link/80">{post.title}</h2>
						</a>
						<div class="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
							<time datetime={post.date}>{formatDate(post.date)}</time>
							{#if post.author}<span>· {post.author}</span>{/if}
							{#if post.category}
								<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
									{post.category}
								</span>
							{/if}
						</div>
						<p class="text-muted-foreground">{post.description}</p>
						<a
							href={resolve(`/blog/${post.slug}`)}
							class="inline-block text-sm font-medium text-link hover:text-link/80"
						>
							{m.blog_read_more()} →
						</a>
					</article>
				</li>
			{/each}
		</ul>
	{/if}
</section>
