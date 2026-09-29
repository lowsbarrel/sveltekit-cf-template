<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let email = $state('');
	let captchaToken = $state('');
	let sent = $state(false);
	let busy = $state(false);

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		await authClient.requestPasswordReset(
			{ email, redirectTo: '/reset-password' },
			captchaToken ? { headers: { 'x-captcha-response': captchaToken } } : undefined
		);
		busy = false;
		sent = true;
	}
</script>

<Seo title={m.forgot_password_title()} noindex />

<div class="space-y-6">
	<h1 class="text-2xl font-semibold">{m.forgot_password_title()}</h1>

	{#if sent}
		<p role="status" class="text-sm text-muted-foreground">{m.reset_link_sent()}</p>
	{:else}
		<p class="text-sm text-muted-foreground">{m.forgot_password_body()}</p>

		<form onsubmit={submit} class="space-y-4">
			<label class="block">
				<span class="mb-1 block text-sm font-medium">{m.email()}</span>
				<Input type="email" autocomplete="email" bind:value={email} required />
			</label>

			{#if data.turnstileSiteKey}
				<Turnstile siteKey={data.turnstileSiteKey} bind:token={captchaToken} />
			{/if}

			<Button
				type="submit"
				class="w-full"
				disabled={busy || !hydrated || (!!data.turnstileSiteKey && !captchaToken)}
			>
				{m.send_reset_link()}
			</Button>
		</form>
	{/if}

	<a href={resolve('/login')} class="block text-sm text-link underline hover:text-link/80">
		{m.back_to_sign_in()}
	</a>
</div>
