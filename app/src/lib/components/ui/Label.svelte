<script lang="ts">
	import { Label, type LabelRootProps } from 'bits-ui';
	import { cn } from '$lib/utils/cn';

	let { class: className, ref = $bindable(null), children, ...rest }: LabelRootProps = $props();
</script>

<Label.Root
	bind:ref
	class={cn(
		'text-sm leading-none font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
		className
	)}
	{...rest}
>
	{@render children?.()}
</Label.Root>
