<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { safeNext } from '$lib/utils/redirect';
	import * as m from '$lib/paraglide/messages';

	const next = $derived(safeNext(page.url.searchParams.get('next')));

	let code = $state('');
	let useBackup = $state(false);
	let busy = $state(false);
	let error = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		const res = useBackup
			? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
			: await authClient.twoFactor.verifyTotp({ code: code.trim() });
		busy = false;
		if (res.error) {
			error = res.error.message ?? m.error_generic();
			return;
		}
		await goto(next, { invalidateAll: true });
	}
</script>

<Seo title={m.twofa_title()} noindex />

<div class="space-y-6">
	<div class="space-y-1">
		<h1 class="text-2xl font-semibold">{m.twofa_title()}</h1>
		<p class="text-sm text-muted-foreground">
			{useBackup ? m.twofa_backup_desc() : m.twofa_desc()}
		</p>
	</div>

	<form onsubmit={submit} class="space-y-4">
		<label class="block">
			<span class="mb-1 block text-sm font-medium">
				{useBackup ? m.twofa_backup_label() : m.twofa_code_label()}
			</span>
			<Input
				bind:value={code}
				inputmode={useBackup ? 'text' : 'numeric'}
				autocomplete="one-time-code"
				required
				class="tracking-widest"
			/>
		</label>

		{#if error}
			<p role="alert" class="text-sm text-destructive">{error}</p>
		{/if}

		<Button type="submit" class="w-full" disabled={busy}>
			{m.twofa_verify()}
		</Button>
	</form>

	<button
		onclick={() => {
			useBackup = !useBackup;
			code = '';
			error = '';
		}}
		class="text-sm text-link underline hover:text-link/80"
	>
		{useBackup ? m.twofa_use_totp() : m.twofa_use_backup()}
	</button>
</div>
