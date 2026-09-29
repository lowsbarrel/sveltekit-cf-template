<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { X } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import * as m from '$lib/paraglide/messages';

	let {
		open = $bindable(false),
		title,
		description,
		trigger,
		children,
		footer,
		class: className
	}: {
		open?: boolean;
		title: string;
		description?: string;
		trigger?: Snippet;
		children?: Snippet;
		footer?: Snippet;
		class?: string;
	} = $props();
</script>

<Dialog.Root bind:open>
	{#if trigger}
		<Dialog.Trigger>{@render trigger()}</Dialog.Trigger>
	{/if}
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<Dialog.Content
			class={cn(
				'fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg focus-visible:outline-none',
				className
			)}
		>
			<div class="flex flex-col gap-1.5">
				<Dialog.Title class="text-lg font-semibold">{title}</Dialog.Title>
				{#if description}
					<Dialog.Description class="text-sm text-muted-foreground">
						{description}
					</Dialog.Description>
				{/if}
			</div>
			{#if children}
				<div class="py-4">{@render children()}</div>
			{/if}
			{#if footer}
				<div class="flex justify-end gap-2">{@render footer()}</div>
			{/if}
			<Dialog.Close
				class="absolute top-4 right-4 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			>
				<X class="h-4 w-4" aria-hidden="true" />
				<span class="sr-only">{m.ui_close()}</span>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
