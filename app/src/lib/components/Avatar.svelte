<script lang="ts">
	interface Props {
		name?: string | null;
		email?: string | null;
		image?: string | null;
		size?: number;
		class?: string;
	}
	let { name = null, email = null, image = null, size = 32, class: klass = '' }: Props = $props();

	const label = $derived(name?.trim() || email?.trim() || '?');
	const initials = $derived(
		label
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? '')
			.join('') ||
			label[0]?.toUpperCase() ||
			'?'
	);
	const hue = $derived(
		Math.abs([...label].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360
	);
</script>

{#if image}
	<img
		src={image}
		alt={label}
		class="rounded-full object-cover {klass}"
		style="width:{size}px;height:{size}px"
	/>
{:else}
	<span
		role="img"
		aria-label={label}
		class="inline-flex items-center justify-center rounded-full font-medium text-white select-none {klass}"
		style="width:{size}px;height:{size}px;font-size:{Math.round(
			size * 0.4
		)}px;background-color:oklch(50% 0.1 {hue})"
	>
		{initials}
	</span>
{/if}
