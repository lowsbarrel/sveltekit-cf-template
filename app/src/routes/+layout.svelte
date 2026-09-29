<script lang="ts">
	import '@fontsource-variable/inter';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import ConsentBanner from '$lib/components/ConsentBanner.svelte';
	import UpdateToast from '$lib/components/UpdateToast.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<ConsentBanner />
<UpdateToast />
