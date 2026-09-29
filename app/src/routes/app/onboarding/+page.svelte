<script lang="ts">
	import { Check, UserPlus } from '@lucide/svelte';
	import { authClient } from '$lib/auth-client';
	import AvatarUploader from '$lib/components/AvatarUploader.svelte';
	import PlanCard from '$lib/components/billing/PlanCard.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { planName } from '$lib/plan-display';
	import { SITE } from '$lib/site';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const total = 4;
	let step = $state(0);
	let busy = $state(false);
	let error = $state('');

	// svelte-ignore state_referenced_locally
	let workspaceName = $state(data.org.name);
	// svelte-ignore state_referenced_locally
	let displayName = $state(data.user.name);
	let inviteEmail = $state('');
	let invited = $state<string[]>([]);
	let inviteErr = $state('');

	async function saveWorkspace() {
		const name = workspaceName.trim();
		if (!name) {
			error = m.error_generic();
			return;
		}
		busy = true;
		error = '';
		const res = await authClient.organization.update({
			organizationId: data.org.id,
			data: { name }
		});
		busy = false;
		if (res.error) {
			error = res.error.message ?? m.error_generic();
			return;
		}
		step = 1;
	}

	async function saveProfile() {
		const name = displayName.trim();
		if (!name) {
			error = m.error_generic();
			return;
		}
		busy = true;
		error = '';
		const res = await authClient.updateUser({ name });
		busy = false;
		if (res.error) {
			error = res.error.message ?? m.error_generic();
			return;
		}
		step = 2;
	}

	async function sendInvite() {
		const email = inviteEmail.trim();
		if (!email) return;
		inviteErr = '';
		busy = true;
		const res = await authClient.organization.inviteMember({
			email,
			role: 'member',
			organizationId: data.org.id
		});
		busy = false;
		if (res.error) {
			inviteErr = res.error.message ?? m.team_invite_failed();
			return;
		}
		invited = [...invited, email];
		inviteEmail = '';
	}
</script>

<Seo title={m.onboarding_title({ name: SITE.name })} noindex />

<main class="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 p-6">
	<div class="space-y-2">
		<p class="text-sm font-medium text-link">{m.onboarding_step({ n: step + 1, total })}</p>
		<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
			<div
				class="h-full rounded-full bg-primary-600 transition-all"
				style="width:{((step + 1) / total) * 100}%"
			></div>
		</div>
	</div>

	<div class="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
		{#if step === 0}
			<div class="space-y-1">
				<h1 class="text-xl font-semibold">{m.onboarding_workspace_title()}</h1>
				<p class="text-sm text-muted-foreground">{m.onboarding_workspace_tagline()}</p>
			</div>
			<label class="block space-y-1">
				<span class="text-sm font-medium text-muted-foreground"
					>{m.onboarding_workspace_label()}</span
				>
				<Input bind:value={workspaceName} maxlength={100} />
			</label>
			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}
			<div class="flex justify-end">
				<Button type="button" onclick={saveWorkspace} disabled={busy}>
					{m.onboarding_next()}
				</Button>
			</div>
		{:else if step === 1}
			<div class="space-y-1">
				<h1 class="text-xl font-semibold">{m.onboarding_profile_title()}</h1>
				<p class="text-sm text-muted-foreground">{m.onboarding_profile_tagline()}</p>
			</div>
			<AvatarUploader
				name={data.user.name}
				email={data.user.email}
				image={data.user.image}
				uploadEnabled={data.uploadEnabled}
			/>
			<label class="block space-y-1">
				<span class="text-sm font-medium text-muted-foreground">{m.profile_name_label()}</span>
				<Input bind:value={displayName} maxlength={100} />
			</label>
			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}
			<div class="flex justify-between">
				<button
					onclick={() => (step = 0)}
					class="text-sm text-muted-foreground hover:text-foreground"
				>
					{m.onboarding_back()}
				</button>
				<Button type="button" onclick={saveProfile} disabled={busy}>
					{m.onboarding_next()}
				</Button>
			</div>
		{:else if step === 2}
			<div class="space-y-1">
				<h1 class="text-xl font-semibold">{m.onboarding_invite_title()}</h1>
				<p class="text-sm text-muted-foreground">{m.onboarding_invite_tagline()}</p>
			</div>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					sendInvite();
				}}
				class="flex items-end gap-2"
			>
				<label class="min-w-0 flex-1 space-y-1">
					<span class="text-sm font-medium text-muted-foreground"
						>{m.team_invite_email_label()}</span
					>
					<Input type="email" bind:value={inviteEmail} placeholder={m.onboarding_invite_email()} />
				</label>
				<Button type="submit" disabled={busy}>
					<UserPlus class="h-4 w-4" />
					{m.onboarding_invite_add()}
				</Button>
			</form>
			{#if inviteErr}
				<p role="alert" class="text-sm text-destructive">{inviteErr}</p>
			{/if}
			{#if invited.length > 0}
				<ul class="space-y-1">
					{#each invited as email (email)}
						<li class="flex items-center gap-2 text-sm text-muted-foreground">
							<Check class="h-4 w-4 text-success" />
							{m.team_invite_sent({ email })}
						</li>
					{/each}
				</ul>
			{/if}
			<div class="flex justify-between">
				<button
					onclick={() => (step = 1)}
					class="text-sm text-muted-foreground hover:text-foreground"
				>
					{m.onboarding_back()}
				</button>
				<Button type="button" onclick={() => (step = 3)}>
					{invited.length > 0 ? m.onboarding_next() : m.onboarding_skip()}
				</Button>
			</div>
		{:else}
			<div class="space-y-1">
				<h1 class="text-xl font-semibold">{m.onboarding_plan_title()}</h1>
				<p class="text-sm text-muted-foreground">{m.onboarding_plan_tagline()}</p>
			</div>
			{#if data.plans.length > 0 && data.billingConfigured}
				<div class="space-y-4">
					{#each data.plans as plan (plan.id)}
						<PlanCard {plan}>
							{#snippet cta()}
								<form method="POST" action="?/finish">
									<input type="hidden" name="plan" value={plan.id} />
									<Button type="submit" class="w-full">
										{m.plan_choose({ plan: planName(plan) })}
									</Button>
								</form>
							{/snippet}
						</PlanCard>
					{/each}
				</div>
			{/if}
			<div class="flex justify-between">
				<button
					onclick={() => (step = 2)}
					class="text-sm text-muted-foreground hover:text-foreground"
				>
					{m.onboarding_back()}
				</button>
				<form method="POST" action="?/finish">
					<Button type="submit" variant="outline">
						{data.plans.length > 0 && data.billingConfigured
							? m.onboarding_plan_free()
							: m.onboarding_finish()}
					</Button>
				</form>
			</div>
		{/if}
	</div>
</main>
