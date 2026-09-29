<script lang="ts">
	import { enhance } from '$app/forms';
	import PlanCard from '$lib/components/billing/PlanCard.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { planName } from '$lib/plan-display';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const periodEnd = $derived(
		data.subscription?.currentPeriodEnd
			? new Date(data.subscription.currentPeriodEnd).toLocaleDateString()
			: null
	);

	const manageable = $derived(
		!!data.subscription &&
			data.subscription.status !== 'canceled' &&
			data.subscription.status !== 'expired'
	);
</script>

<Seo title={m.billing_title()} noindex />

<main class="mx-auto max-w-5xl space-y-8 p-4 sm:p-8">
	<div class="space-y-1">
		<h1 class="text-2xl font-semibold">{m.billing_title()}</h1>
		<p class="text-muted-foreground">{m.billing_on_plan({ plan: planName(data.plan) })}</p>
	</div>

	{#if !data.configured}
		<p class="rounded border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
			{m.billing_unconfigured()}
		</p>
	{/if}

	{#if data.subscription}
		<section
			class="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-6"
		>
			<div class="flex items-center gap-2">
				<span class="font-medium">{m.billing_plan_status()}</span>
				<span
					class="rounded px-2 py-1 text-sm {data.entitled
						? 'bg-success/10 text-success'
						: 'bg-destructive/10 text-destructive'}"
				>
					{data.subscription.status}
				</span>
			</div>
			{#if periodEnd}
				<p class="text-sm text-muted-foreground">{m.billing_renews_on({ date: periodEnd })}</p>
			{/if}
		</section>
	{/if}

	{#if data.canManage}
		{#if data.canceled}
			<p class="rounded border border-primary-500/40 bg-primary-500/10 p-4 text-sm text-foreground">
				{m.billing_cancel_requested()}
			</p>
		{/if}

		{#if data.resynced}
			<p class="rounded border border-success/30 bg-success/10 p-4 text-sm text-success">
				{m.billing_resynced()}
			</p>
		{/if}

		{#if !manageable}
			{#if data.availablePlans.length > 0}
				<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.availablePlans as plan (plan.id)}
						<PlanCard {plan} current={false}>
							{#snippet cta()}
								<form method="POST" action="?/checkout" use:enhance>
									<input type="hidden" name="plan" value={plan.id} />
									<Button type="submit" class="w-full" disabled={!data.configured}>
										{m.plan_choose({ plan: planName(plan) })}
									</Button>
								</form>
							{/snippet}
						</PlanCard>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="flex flex-wrap items-center gap-3">
				<form method="POST" action="?/portal" use:enhance>
					<Button type="submit" variant="outline">
						{m.billing_manage()}
					</Button>
				</form>

				<form method="POST" action="?/resync" use:enhance>
					<Button type="submit" variant="outline">
						{m.billing_resync()}
					</Button>
				</form>

				{#if data.subscription?.status === 'scheduled_cancel'}
					<p class="text-sm text-muted-foreground">
						{m.billing_cancels_on({ date: periodEnd ?? '' })}
					</p>
				{:else}
					<form
						method="POST"
						action="?/cancel"
						use:enhance={({ cancel }) => {
							if (!confirm(m.billing_cancel_confirm())) cancel();
						}}
					>
						<Button type="submit" variant="destructive">
							{m.billing_cancel()}
						</Button>
					</form>
				{/if}
			</div>
			<p class="text-sm text-muted-foreground">{m.billing_manage_hint()}</p>

			{#if data.webhook.secretSet}
				{#if data.webhook.lastReceivedAt}
					<p class="text-xs text-muted-foreground/70">
						{m.billing_webhook_last({
							date: new Date(data.webhook.lastReceivedAt).toLocaleDateString()
						})}
					</p>
				{:else}
					<p class="rounded border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
						{m.billing_webhook_none()}
					</p>
				{/if}
			{/if}
		{/if}
	{:else}
		<p class="text-sm text-muted-foreground">{m.billing_admins_only()}</p>
	{/if}
</main>
