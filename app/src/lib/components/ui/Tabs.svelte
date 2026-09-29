<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export type TabItem = { value: string; label: string; content: Snippet };
</script>

<script lang="ts">
	import { Tabs } from 'bits-ui';
	import { cn } from '$lib/utils/cn';

	let {
		value = $bindable(),
		items,
		class: className
	}: { value?: string; items: TabItem[]; class?: string } = $props();
</script>

<Tabs.Root bind:value class={cn('w-full', className)}>
	<Tabs.List
		class="inline-flex h-9 items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground"
	>
		{#each items as item (item.value)}
			<Tabs.Trigger
				value={item.value}
				class="inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
			>
				{item.label}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>
	{#each items as item (item.value)}
		<Tabs.Content value={item.value} class="mt-2 focus-visible:outline-none">
			{@render item.content()}
		</Tabs.Content>
	{/each}
</Tabs.Root>
