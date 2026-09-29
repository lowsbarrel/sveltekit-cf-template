<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { planFeatures, planName, planPrice, planTagline } from '$lib/plan-display';
	import * as m from '$lib/paraglide/messages';
	import type { Plan } from '$lib/plans';
	import type { Snippet } from 'svelte';

	let { plan, current = false, cta }: { plan: Plan; current?: boolean; cta?: Snippet } = $props();
</script>

<div
	class="relative flex flex-col rounded-lg border p-6 text-left {plan.highlighted
		? 'border-primary-600 shadow-sm'
		: 'border-border'}"
>
	{#if plan.highlighted}
		<span
			class="absolute -top-3 left-6 rounded-full bg-primary-600 px-3 py-0.5 text-xs font-medium text-white"
		>
			{m.plan_popular()}
		</span>
	{/if}

	<h3 class="font-semibold">{planName(plan)}</h3>
	<p class="mt-1 text-sm text-muted-foreground">{planTagline(plan)}</p>

	<p class="mt-4">
		<span class="text-3xl font-semibold">{planPrice(plan)}</span>
	</p>

	<ul class="mt-6 flex-1 space-y-3 text-sm">
		{#each planFeatures(plan) as feature (feature)}
			<li class="flex items-start gap-2">
				<Check class="mt-0.5 h-4 w-4 shrink-0 text-link" aria-hidden="true" />
				<span>{feature}</span>
			</li>
		{/each}
	</ul>

	<div class="mt-6">
		{#if current}
			<p class="rounded bg-muted py-2 text-center text-sm font-medium text-muted-foreground">
				{m.plan_current()}
			</p>
		{:else if cta}
			{@render cta()}
		{/if}
	</div>
</div>
