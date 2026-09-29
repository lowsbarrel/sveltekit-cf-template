<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let confirmText = $state('');
	let sending = $state(false);
	let sent = $state(false);
	let error = $state('');

	const ready = $derived(!data.blocked && confirmText === m.danger_confirm_word());

	async function requestDeletion(e: SubmitEvent) {
		e.preventDefault();
		if (!ready) {
			error = m.danger_confirm_mismatch();
			return;
		}
		error = '';
		sending = true;
		const res = await authClient.deleteUser({ callbackURL: '/' });
		sending = false;
		if (res.error) {
			error = res.error.message ?? m.danger_failed();
			return;
		}
		sent = true;
	}
</script>

<section class="space-y-4 pt-4">
	<div class="space-y-1">
		<h2 class="text-lg font-medium text-destructive">{m.danger_title()}</h2>
		<p class="text-sm text-muted-foreground">{m.danger_tagline()}</p>
	</div>

	{#if data.blocked}
		<p class="rounded border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
			{m.danger_blocked_subscription()}
		</p>
	{/if}

	{#if sent}
		<p
			role="status"
			class="rounded border border-success/30 bg-success/10 p-4 text-sm text-success"
		>
			{m.danger_email_sent()}
		</p>
	{:else}
		<form
			onsubmit={requestDeletion}
			class="max-w-md space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
		>
			<label class="block space-y-1">
				<span class="text-sm font-medium text-muted-foreground">{m.danger_confirm_label()}</span>
				<Input
					bind:value={confirmText}
					disabled={data.blocked}
					placeholder={m.danger_confirm_word()}
				/>
			</label>

			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}

			<Button type="submit" variant="destructive" disabled={!ready || sending}>
				{sending ? m.danger_sending() : m.danger_delete()}
			</Button>
		</form>
	{/if}
</section>
