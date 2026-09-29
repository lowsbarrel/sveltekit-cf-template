<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/seo/Seo.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo title={m.newsletter_confirm_title()} noindex />

<main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
	<div class="space-y-4 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
		{#if data.confirmed}
			<h1 class="text-2xl font-semibold">{m.newsletter_confirmed_heading()}</h1>
			<p class="text-muted-foreground">{m.newsletter_confirmed_body()}</p>
		{:else}
			<h1 class="text-2xl font-semibold">{m.newsletter_confirm_invalid_heading()}</h1>
			<p class="text-muted-foreground">{m.newsletter_confirm_invalid_body()}</p>
		{/if}
		<a href={resolve('/')} class="inline-block text-sm text-link underline hover:text-link/80">
			{m.newsletter_confirm_home()}
		</a>
	</div>
</main>
