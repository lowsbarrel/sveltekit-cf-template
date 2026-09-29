<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let busy = $state(false);
	let error = $state('');

	const roleLabels: Record<string, string> = {
		owner: m.team_role_owner(),
		admin: m.team_role_admin(),
		member: m.team_role_member()
	};

	const loginHref = $derived(resolve(`/login?next=${encodeURIComponent(page.url.pathname)}`));
	const emailMatches = $derived(
		!!data.invitation && data.viewerEmail?.toLowerCase() === data.invitation.email.toLowerCase()
	);

	async function accept() {
		if (!data.invitation) return;
		busy = true;
		error = '';
		const res = await authClient.organization.acceptInvitation({
			invitationId: data.invitation.id
		});
		if (res.error) {
			busy = false;
			error = res.error.message ?? m.invite_failed();
			return;
		}
		await authClient.organization.setActive({ organizationId: data.invitation.orgId });
		await goto(resolve('/app'), { invalidateAll: true });
	}

	async function reject() {
		if (!data.invitation) return;
		busy = true;
		error = '';
		const res = await authClient.organization.rejectInvitation({
			invitationId: data.invitation.id
		});
		busy = false;
		if (res.error) {
			error = res.error.message ?? m.invite_failed();
			return;
		}
		await goto(resolve('/'), { invalidateAll: true });
	}

	async function switchAccount() {
		await authClient.signOut();
		await goto(loginHref, { invalidateAll: true });
	}
</script>

<Seo
	title={data.invitation ? m.invite_accept_title({ org: data.invitation.orgName }) : m.sign_in()}
	noindex
/>

<main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
	{#if !data.invitation}
		<div class="space-y-4 text-center">
			<h1 class="text-2xl font-semibold">{m.invite_not_found()}</h1>
			<a href={resolve('/')} class="inline-block text-sm text-link underline">{m.back_home()}</a>
		</div>
	{:else}
		<div class="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
			<div class="space-y-2">
				<h1 class="text-2xl font-semibold">
					{m.invite_accept_title({ org: data.invitation.orgName })}
				</h1>
				<p class="text-muted-foreground">
					{m.invite_accept_body({
						inviter: data.invitation.inviterName,
						org: data.invitation.orgName,
						role: roleLabels[data.invitation.role] ?? data.invitation.role
					})}
				</p>
			</div>

			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}

			{#if !data.viewerEmail}
				<div class="space-y-3">
					<p class="text-sm text-muted-foreground">
						{m.invite_signin_required({ email: data.invitation.email })}
					</p>
					<Button href={loginHref} class="w-full">
						{m.invite_signin_cta()}
					</Button>
				</div>
			{:else if !emailMatches}
				<div class="space-y-3">
					<p class="text-sm text-muted-foreground">{m.invite_wrong_email()}</p>
					<Button type="button" variant="outline" class="w-full" onclick={switchAccount}>
						{m.invite_signin_cta()}
					</Button>
				</div>
			{:else}
				<div class="flex gap-3">
					<Button type="button" class="flex-1" onclick={accept} disabled={busy}>
						{m.invite_accept_cta()}
					</Button>
					<Button type="button" variant="outline" onclick={reject} disabled={busy}>
						{m.invite_reject_cta()}
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</main>
