<script lang="ts">
	import { X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { dismissToast, toasts } from '$lib/toasts.svelte';
	import { safeNext } from '$lib/utils/redirect';
	import * as m from '$lib/paraglide/messages';

	async function open(id: number, href: string | null) {
		dismissToast(id);
		if (href) await goto(safeNext(href));
	}
</script>

<div
	class="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
	aria-live="polite"
>
	{#each toasts.items as t (t.id)}
		<div
			role={t.tone === 'error' ? 'alert' : 'status'}
			class="flex items-start gap-2 rounded-lg border p-3 shadow-lg {t.tone === 'error'
				? 'border-destructive/40 bg-card'
				: 'border-border bg-card'}"
		>
			{#if t.href}
				<button onclick={() => open(t.id, t.href)} class="flex-1 text-left text-sm text-foreground">
					{t.text}
				</button>
			{:else}
				<p class="flex-1 text-sm {t.tone === 'error' ? 'text-destructive' : 'text-foreground'}">
					{t.text}
				</p>
			{/if}
			<button
				onclick={() => dismissToast(t.id)}
				aria-label={m.notifications_dismiss()}
				class="shrink-0 rounded p-0.5 {t.tone === 'error'
					? 'text-destructive hover:text-destructive'
					: 'text-muted-foreground/70 hover:text-muted-foreground'}"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/each}
</div>
