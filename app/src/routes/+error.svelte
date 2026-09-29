<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages';
</script>

<main
	class="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center space-y-4 p-8 text-center"
>
	{#if page.status === 404}
		<p class="text-7xl font-bold text-muted-foreground/30 select-none">404</p>
		<h1 class="text-2xl font-semibold">{m.not_found_title()}</h1>
		<p class="text-muted-foreground">{m.not_found_body()}</p>
	{:else}
		<h1 class="text-4xl font-semibold">{page.status}</h1>
		<p class="text-muted-foreground">{page.error?.message ?? m.error_generic()}</p>
		{#if page.error?.id}
			<p class="text-xs text-muted-foreground/70">{m.error_id_label({ id: page.error.id })}</p>
		{/if}
	{/if}
	<a href={resolve('/')} class="inline-block text-link underline hover:text-link/80">
		{m.back_home()}
	</a>
</main>
