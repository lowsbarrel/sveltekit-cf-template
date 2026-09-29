<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	let {
		class: className,
		header,
		footer,
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & { header?: Snippet; footer?: Snippet } = $props();
</script>

<div
	class={cn('rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)}
	{...rest}
>
	{#if header}
		<div class="flex flex-col gap-1.5 p-6">{@render header()}</div>
	{/if}
	<div class={cn('p-6', header && 'pt-0')}>{@render children?.()}</div>
	{#if footer}
		<div class="flex items-center p-6 pt-0">{@render footer()}</div>
	{/if}
</div>
