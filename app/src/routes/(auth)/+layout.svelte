<script lang="ts">
	import { resolve } from '$app/paths';
	import { SITE } from '$lib/site';

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12">
	<a href={resolve('/')} class="text-lg font-semibold">{SITE.name}</a>
	<main class="w-full max-w-sm rounded-lg border border-border p-8">
		{@render children()}
	</main>
</div>
