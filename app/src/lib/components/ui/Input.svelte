<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	let {
		value = $bindable(),
		ref = $bindable(null),
		class: className,
		...rest
	}: HTMLInputAttributes & { ref?: HTMLInputElement | null } = $props();
</script>

<input
	bind:this={ref}
	bind:value
	class={cn(
		'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{...rest}
/>
