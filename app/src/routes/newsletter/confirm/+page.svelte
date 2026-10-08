<script lang="ts">
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<Seo title={m.newsletter_confirm_title()} noindex />

<main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
	<div class="space-y-4 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
		{#if form?.confirmed}
			<h1 class="text-2xl font-semibold">{m.newsletter_confirmed_heading()}</h1>
			<p class="text-muted-foreground">{m.newsletter_confirmed_body()}</p>
		{:else if form || !data.token}
			<h1 class="text-2xl font-semibold">{m.newsletter_confirm_invalid_heading()}</h1>
			<p class="text-muted-foreground">{m.newsletter_confirm_invalid_body()}</p>
		{:else}
			<h1 class="text-2xl font-semibold">{m.newsletter_confirm_title()}</h1>
			<p class="text-muted-foreground">{m.newsletter_confirm_prompt()}</p>
			<form method="POST" class="pt-2">
				<input type="hidden" name="token" value={data.token} />
				<Button type="submit">{m.newsletter_confirm_button()}</Button>
			</form>
		{/if}
		<a href={resolve('/')} class="inline-block text-sm text-link underline hover:text-link/80">
			{m.newsletter_confirm_home()}
		</a>
	</div>
</main>
