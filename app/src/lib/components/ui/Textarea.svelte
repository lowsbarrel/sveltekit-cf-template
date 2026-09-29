<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	let {
		value = $bindable(),
		ref = $bindable(null),
		class: className,
		...rest
	}: HTMLTextareaAttributes & { ref?: HTMLTextAreaElement | null } = $props();
</script>

<textarea
	bind:this={ref}
	bind:value
	class={cn(
		'flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{...rest}></textarea>
