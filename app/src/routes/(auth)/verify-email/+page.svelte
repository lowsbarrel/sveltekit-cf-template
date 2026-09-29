<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let email = $state('');
	let sent = $state(false);
	let busy = $state(false);

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	async function resend(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		await authClient.sendVerificationEmail({ email, callbackURL: '/verify-email' });
		busy = false;
		sent = true;
	}
</script>

<Seo title={m.verify_email_title()} noindex />

<div class="space-y-6">
	<h1 class="text-2xl font-semibold">{m.verify_email_title()}</h1>

	{#if sent}
		<p role="status" class="text-sm text-muted-foreground">{m.verify_email_resent()}</p>
	{:else}
		<p class="text-sm {data.failed ? 'text-destructive' : 'text-muted-foreground'}">
			{data.failed ? m.verify_email_invalid() : m.verify_email_pending()}
		</p>

		<form onsubmit={resend} class="space-y-4">
			<label class="block">
				<span class="mb-1 block text-sm font-medium">{m.email()}</span>
				<Input type="email" autocomplete="email" bind:value={email} required />
			</label>

			<Button type="submit" class="w-full" disabled={busy || !hydrated}>
				{m.verify_email_resend()}
			</Button>
		</form>
	{/if}

	<a href={resolve('/login')} class="block text-sm text-link underline hover:text-link/80">
		{m.back_to_sign_in()}
	</a>
</div>
