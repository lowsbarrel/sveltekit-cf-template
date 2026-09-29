<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { analyticsEnabled, initAnalytics } from '$lib/analytics';
	import { readConsent, writeConsent } from '$lib/consent';
	import * as m from '$lib/paraglide/messages';

	let show = $state(false);

	onMount(() => {
		if (!analyticsEnabled) return;
		const consent = readConsent();
		if (consent === 'granted') void initAnalytics();
		show = consent === null;
	});

	function accept() {
		writeConsent('granted');
		show = false;
		void initAnalytics();
	}

	function decline() {
		writeConsent('denied');
		show = false;
	}
</script>

{#if show}
	<div
		role="alert"
		class="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur"
	>
		<div
			class="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
		>
			<p class="text-muted-foreground">
				{m.consent_message()}
				<a href={resolve('/cookies')} class="text-link underline hover:text-link/80">
					{m.consent_learn_more()}
				</a>
			</p>
			<div class="flex shrink-0 gap-2">
				<button
					onclick={decline}
					class="rounded border border-input px-4 py-2 font-medium text-muted-foreground hover:border-foreground/40"
				>
					{m.consent_decline()}
				</button>
				<button
					onclick={accept}
					class="rounded bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700"
				>
					{m.consent_accept()}
				</button>
			</div>
		</div>
	</div>
{/if}
