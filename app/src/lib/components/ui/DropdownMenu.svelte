<script lang="ts" module>
	import type { Component } from 'svelte';

	export type DropdownItem = {
		label: string;
		onSelect?: () => void;
		icon?: Component;
		disabled?: boolean;
		separatorBefore?: boolean;
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { DropdownMenu } from 'bits-ui';
	import { cn } from '$lib/utils/cn';

	let {
		open = $bindable(false),
		trigger,
		items,
		class: className
	}: { open?: boolean; trigger: Snippet; items: DropdownItem[]; class?: string } = $props();
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>{@render trigger()}</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			sideOffset={4}
			class={cn(
				'z-50 min-w-40 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg focus-visible:outline-none',
				className
			)}
		>
			{#each items as item, i (i)}
				{#if item.separatorBefore}
					<DropdownMenu.Separator class="my-1 h-px bg-border" />
				{/if}
				<DropdownMenu.Item
					disabled={item.disabled}
					onSelect={item.onSelect}
					class="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50"
				>
					{#if item.icon}
						{@const Icon = item.icon}
						<Icon class="h-4 w-4" aria-hidden="true" />
					{/if}
					{item.label}
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
