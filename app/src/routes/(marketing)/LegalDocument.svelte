<script lang="ts">
	import Seo from '$lib/components/seo/Seo.svelte';
	import * as m from '$lib/paraglide/messages';
	import LegalNotice from './LegalNotice.svelte';

	export type Section = { heading: string; body: string[] };

	let {
		title,
		description,
		lastUpdated,
		sections
	}: {
		title: string;
		description: string;
		lastUpdated: string;
		sections: Section[];
	} = $props();
</script>

<Seo {title} {description} />

<article class="mx-auto max-w-2xl space-y-8 px-6 py-16">
	<header class="space-y-2">
		<h1 class="text-3xl font-semibold">{title}</h1>
		<p class="text-sm text-muted-foreground">{m.legal_last_updated({ date: lastUpdated })}</p>
	</header>

	<LegalNotice />

	{#each sections as section (section.heading)}
		<section class="space-y-3">
			<h2 class="text-lg font-semibold">{section.heading}</h2>
			{#each section.body as paragraph (paragraph)}
				<p class="text-muted-foreground">{paragraph}</p>
			{/each}
		</section>
	{/each}
</article>
