<script lang="ts">
	import { Sparkles } from '@lucide/svelte';
	import { safeNext } from '$lib/utils/redirect';
	import * as m from '$lib/paraglide/messages';

	let { href }: { href?: string } = $props();
</script>

<p
	role="note"
	class="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
>
	<Sparkles class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
	<span>
		{m.ai_disclosure_message()}
		{#if href}
			<a href={safeNext(href)} class="underline hover:text-foreground">
				{m.ai_disclosure_learn_more()}
			</a>
		{/if}
	</span>
</p>
