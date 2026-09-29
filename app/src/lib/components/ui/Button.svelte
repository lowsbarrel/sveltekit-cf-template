<script lang="ts" module>
	export type ButtonVariant =
		'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
	export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

	export const buttonVariants: Record<ButtonVariant, string> = {
		default: 'bg-primary-600 text-white hover:bg-primary-700',
		destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
		outline: 'border border-input bg-background hover:bg-muted hover:text-foreground',
		secondary: 'bg-muted text-foreground hover:bg-muted/80',
		ghost: 'hover:bg-muted hover:text-foreground',
		link: 'text-link underline-offset-4 hover:underline'
	};

	export const buttonSizes: Record<ButtonSize, string> = {
		default: 'h-9 px-4 py-2',
		sm: 'h-8 rounded-md px-3 text-xs',
		lg: 'h-10 rounded-md px-8',
		icon: 'h-9 w-9'
	};
</script>

<script lang="ts">
	import { Button, type ButtonRootProps } from 'bits-ui';
	import { cn } from '$lib/utils/cn';

	let {
		variant = 'default',
		size = 'default',
		class: className,
		ref = $bindable(null),
		children,
		...rest
	}: ButtonRootProps & { variant?: ButtonVariant; size?: ButtonSize; class?: string } = $props();
</script>

<Button.Root
	bind:ref
	class={cn(
		'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
		buttonVariants[variant],
		buttonSizes[size],
		className
	)}
	{...rest}
>
	{@render children?.()}
</Button.Root>
