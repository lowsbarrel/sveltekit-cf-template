<script lang="ts">
	import { onMount } from 'svelte';
	import { identifyUser } from '$lib/analytics';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	onMount(() => identifyUser(data.user.id, data.user.email));
</script>

{@render children()}
