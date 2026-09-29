<script lang="ts">
	import { resolve } from '$app/paths';
	import PlanCard from '$lib/components/billing/PlanCard.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import * as m from '$lib/paraglide/messages';
	import { PLAN_LIST } from '$lib/plans';
</script>

<Seo title={m.pricing_title()} description={m.pricing_meta_description()} />

<section class="mx-auto max-w-5xl px-6 py-16 sm:py-20">
	<div class="text-center">
		<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{m.pricing_title()}</h1>
		<p class="mx-auto mt-4 max-w-lg text-muted-foreground">{m.pricing_subtitle()}</p>
	</div>

	<div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each PLAN_LIST as plan (plan.id)}
			<PlanCard {plan}>
				{#snippet cta()}
					<Button
						href={resolve('/signup')}
						variant={plan.highlighted ? 'default' : 'outline'}
						class="w-full"
					>
						{m.get_started()}
					</Button>
				{/snippet}
			</PlanCard>
		{/each}
	</div>

	<p class="mt-8 text-center text-sm text-muted-foreground">{m.pricing_tax_note()}</p>
</section>
