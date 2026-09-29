<script lang="ts">
	import { LogOut, Trash2, UserPlus, X } from '@lucide/svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import Avatar from '$lib/components/Avatar.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { can } from '$lib/permissions';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const role = $derived(data.org.role);
	const canInvite = $derived(can(role, { invitation: ['create'] }));
	const canUpdateRole = $derived(can(role, { member: ['update'] }));
	const canRemove = $derived(can(role, { member: ['delete'] }));

	const roleLabels: Record<string, string> = {
		owner: m.team_role_owner(),
		admin: m.team_role_admin(),
		member: m.team_role_member()
	};

	let inviteEmail = $state('');
	let inviteRole = $state('member');
	let inviteBusy = $state(false);
	let inviteMsg = $state('');
	let inviteErr = $state('');
	let actionErr = $state('');

	async function invite(e: SubmitEvent) {
		e.preventDefault();
		inviteErr = '';
		inviteMsg = '';
		inviteBusy = true;
		const email = inviteEmail.trim();
		const res = await authClient.organization.inviteMember({
			email,
			role: inviteRole as 'member' | 'admin',
			organizationId: data.org.id
		});
		inviteBusy = false;
		if (res.error) {
			inviteErr = res.error.message ?? m.team_invite_failed();
			return;
		}
		inviteMsg = m.team_invite_sent({ email });
		inviteEmail = '';
		await invalidateAll();
	}

	async function setRole(memberId: string, next: string) {
		actionErr = '';
		const res = await authClient.organization.updateMemberRole({
			memberId,
			role: next as 'member' | 'admin',
			organizationId: data.org.id
		});
		if (res.error) actionErr = res.error.message ?? m.error_generic();
		await invalidateAll();
	}

	async function removeMember(email: string) {
		actionErr = '';
		const res = await authClient.organization.removeMember({
			memberIdOrEmail: email,
			organizationId: data.org.id
		});
		if (res.error) actionErr = res.error.message ?? m.error_generic();
		await invalidateAll();
	}

	async function cancelInvite(invitationId: string) {
		actionErr = '';
		const res = await authClient.organization.cancelInvitation({ invitationId });
		if (res.error) actionErr = res.error.message ?? m.error_generic();
		await invalidateAll();
	}

	async function leave() {
		if (!confirm(m.team_leave_confirm({ org: data.org.name }))) return;
		actionErr = '';
		const res = await authClient.organization.leave({ organizationId: data.org.id });
		if (res.error) {
			actionErr = res.error.message ?? m.error_generic();
			return;
		}
		const { data: orgs } = await authClient.organization.list();
		const fallback = orgs?.[0];
		if (fallback) {
			await authClient.organization.setActive({ organizationId: fallback.id });
		}
		await goto(resolve('/app'), { invalidateAll: true });
	}
</script>

<Seo title={m.team_title()} noindex />

<main class="mx-auto max-w-3xl space-y-8 p-4 sm:p-8">
	<header class="flex flex-wrap items-start justify-between gap-3">
		<div class="space-y-1">
			<h1 class="text-2xl font-semibold">{m.team_title()}</h1>
			<p class="text-sm text-muted-foreground">{m.team_tagline({ org: data.org.name })}</p>
		</div>
		{#if role !== 'owner'}
			<Button type="button" variant="outline" size="sm" onclick={leave}>
				<LogOut class="h-4 w-4" />
				{m.team_leave()}
			</Button>
		{/if}
	</header>

	{#if actionErr}
		<p
			role="alert"
			class="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
		>
			{actionErr}
		</p>
	{/if}

	{#if canInvite}
		<section class="space-y-3 rounded-lg border border-border p-4">
			<h2 class="font-medium">{m.team_invite_title()}</h2>
			<form onsubmit={invite} class="flex flex-wrap items-end gap-2">
				<label class="min-w-0 flex-1 space-y-1">
					<span class="text-sm text-muted-foreground">{m.team_invite_email_label()}</span>
					<Input
						type="email"
						bind:value={inviteEmail}
						required
						placeholder="teammate@example.com"
					/>
				</label>
				<label class="space-y-1">
					<span class="text-sm text-muted-foreground">{m.team_invite_role_label()}</span>
					<select
						bind:value={inviteRole}
						class="rounded border border-input px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
					>
						<option value="member">{m.team_role_member()}</option>
						<option value="admin">{m.team_role_admin()}</option>
					</select>
				</label>
				<Button type="submit" disabled={inviteBusy}>
					<UserPlus class="h-4 w-4" />
					{m.team_invite_send()}
				</Button>
			</form>
			{#if inviteErr}
				<p role="alert" class="text-sm text-destructive">{inviteErr}</p>
			{/if}
			{#if inviteMsg}
				<p role="status" class="text-sm text-success">{inviteMsg}</p>
			{/if}
		</section>
	{/if}

	<section class="space-y-3">
		<h2 class="font-medium">{m.team_members_heading()}</h2>
		<ul class="divide-y divide-border rounded-lg border border-border">
			{#each data.members as member (member.memberId)}
				{@const isSelf = member.userId === data.user.id}
				{@const editable = canUpdateRole && member.role !== 'owner' && !isSelf}
				<li class="flex items-center justify-between gap-3 px-4 py-3">
					<div class="flex min-w-0 items-center gap-3">
						<Avatar name={member.name} email={member.email} image={member.image} size={36} />
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-foreground">
								{member.name}
								{#if isSelf}
									<span class="text-xs font-normal text-muted-foreground">({m.team_you()})</span>
								{/if}
							</p>
							<p class="truncate text-xs text-muted-foreground">{member.email}</p>
						</div>
					</div>
					<div class="flex shrink-0 items-center gap-2">
						{#if editable}
							<select
								value={member.role}
								onchange={(e) => setRole(member.memberId, e.currentTarget.value)}
								class="rounded border border-input px-2 py-1 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
							>
								<option value="member">{m.team_role_member()}</option>
								<option value="admin">{m.team_role_admin()}</option>
							</select>
						{:else}
							<span class="text-sm text-muted-foreground"
								>{roleLabels[member.role] ?? member.role}</span
							>
						{/if}
						{#if canRemove && !isSelf && member.role !== 'owner'}
							<button
								onclick={() => removeMember(member.email)}
								aria-label={m.team_member_remove()}
								class="rounded p-1.5 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</section>

	{#if canInvite}
		<section class="space-y-3">
			<h2 class="font-medium">{m.team_invites_heading()}</h2>
			{#if data.invites.length > 0}
				<ul class="divide-y divide-border rounded-lg border border-border">
					{#each data.invites as invite (invite.id)}
						<li class="flex items-center justify-between gap-3 px-4 py-3">
							<div class="min-w-0">
								<p class="truncate text-sm text-foreground">{invite.email}</p>
								<p class="text-xs text-muted-foreground">
									{roleLabels[invite.role] ?? invite.role} · {m.team_invite_pending()}
								</p>
							</div>
							<button
								onclick={() => cancelInvite(invite.id)}
								aria-label={m.team_invite_revoke()}
								class="flex items-center gap-1 rounded p-1.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
							>
								<X class="h-4 w-4" />
								{m.team_invite_revoke()}
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground">{m.team_no_invites()}</p>
			{/if}
		</section>
	{/if}
</main>
