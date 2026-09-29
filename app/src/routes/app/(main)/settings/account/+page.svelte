<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let newEmail = $state('');
	let emailBusy = $state(false);
	let emailSent = $state(false);
	let emailError = $state('');

	async function changeEmail(e: SubmitEvent) {
		e.preventDefault();
		emailError = '';
		emailSent = false;
		emailBusy = true;
		const res = await authClient.changeEmail({
			newEmail: newEmail.trim(),
			callbackURL: '/app/settings/account'
		});
		emailBusy = false;
		if (res.error) {
			emailError = res.error.message ?? m.error_generic();
			return;
		}
		emailSent = true;
		newEmail = '';
	}

	let currentPassword = $state('');
	let nextPassword = $state('');
	let revokeOthers = $state(true);
	let pwBusy = $state(false);
	let pwDone = $state(false);
	let pwError = $state('');

	async function changePassword(e: SubmitEvent) {
		e.preventDefault();
		pwError = '';
		pwDone = false;
		pwBusy = true;
		const res = await authClient.changePassword({
			currentPassword,
			newPassword: nextPassword,
			revokeOtherSessions: revokeOthers
		});
		pwBusy = false;
		if (res.error) {
			pwError = res.error.message ?? m.error_generic();
			return;
		}
		pwDone = true;
		currentPassword = '';
		nextPassword = '';
	}
</script>

<section class="space-y-10 pt-4">
	<div class="max-w-md space-y-4">
		<div class="space-y-1">
			<h2 class="text-lg font-medium">{m.account_email_title()}</h2>
			<p class="text-sm text-muted-foreground">{m.account_email_verify_hint()}</p>
		</div>
		<div class="flex items-center gap-2 text-sm">
			<span class="text-muted-foreground">{m.account_email_current()}:</span>
			<span class="font-medium">{data.user.email}</span>
			{#if !data.user.emailVerified}
				<span class="rounded bg-warning/10 px-2 py-0.5 text-xs text-warning">
					{m.account_email_unverified()}
				</span>
			{/if}
		</div>
		<form onsubmit={changeEmail} class="space-y-3">
			<label class="block space-y-1">
				<span class="text-sm font-medium text-muted-foreground">{m.account_email_new_label()}</span>
				<Input type="email" bind:value={newEmail} required />
			</label>
			{#if emailError}
				<p role="alert" class="text-sm text-destructive">{emailError}</p>
			{/if}
			{#if emailSent}
				<p role="status" class="text-sm text-success">{m.account_email_changed()}</p>
			{/if}
			<Button type="submit" disabled={emailBusy}>
				{m.account_email_change()}
			</Button>
		</form>
	</div>

	<div class="max-w-md space-y-4">
		<h2 class="text-lg font-medium">{m.account_password_title()}</h2>
		{#if data.hasPassword}
			<form onsubmit={changePassword} class="space-y-3">
				<label class="block space-y-1">
					<span class="text-sm font-medium text-muted-foreground"
						>{m.account_password_current_label()}</span
					>
					<Input
						type="password"
						bind:value={currentPassword}
						required
						autocomplete="current-password"
					/>
				</label>
				<label class="block space-y-1">
					<span class="text-sm font-medium text-muted-foreground"
						>{m.account_password_new_label()}</span
					>
					<Input
						type="password"
						bind:value={nextPassword}
						required
						minlength={8}
						autocomplete="new-password"
					/>
				</label>
				<label class="flex items-center gap-2 text-sm text-muted-foreground">
					<input type="checkbox" bind:checked={revokeOthers} class="rounded border-input" />
					{m.account_password_revoke_others()}
				</label>
				{#if pwError}
					<p role="alert" class="text-sm text-destructive">{pwError}</p>
				{/if}
				{#if pwDone}
					<p role="status" class="text-sm text-success">{m.account_password_changed()}</p>
				{/if}
				<Button type="submit" disabled={pwBusy}>
					{m.account_password_change()}
				</Button>
			</form>
		{:else}
			<p class="text-sm text-muted-foreground">{m.account_password_google_only()}</p>
		{/if}
	</div>
</section>
