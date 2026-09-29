<script lang="ts">
	import { updated } from '$app/state';
	import * as m from '$lib/paraglide/messages';
</script>

{#if updated.current}
	<div
		role="alert"
		class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-background/95 px-4 py-2 text-sm shadow-lg backdrop-blur"
	>
		<span class="text-muted-foreground">{m.update_available_message()}</span>
		<button
			onclick={() => location.reload()}
			class="rounded-full bg-primary-600 px-3 py-1 font-medium text-white hover:bg-primary-700"
		>
			{m.update_available_action()}
		</button>
	</div>
{/if}
