<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import * as m from '$lib/paraglide/messages';

	const linkError = $derived(page.url.searchParams.get('error'));

	let email = $state('');
	let sent = $state(false);
	let busy = $state(false);

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		await authClient.signIn.magicLink({
			email,
			callbackURL: '/app',
			errorCallbackURL: '/magic-link?error=expired'
		});
		busy = false;
		sent = true;
	}
</script>

<Seo title={m.magic_link_title()} noindex />

<div class="space-y-6">
	<h1 class="text-2xl font-semibold">{m.magic_link_title()}</h1>

	{#if sent}
		<p role="status" class="text-sm text-muted-foreground">{m.magic_link_sent()}</p>
	{:else}
		{#if linkError}
			<p role="alert" class="text-sm text-destructive">{m.magic_link_invalid()}</p>
		{/if}
		<p class="text-sm text-muted-foreground">{m.magic_link_body()}</p>

		<form onsubmit={submit} class="space-y-4">
			<label class="block">
				<span class="mb-1 block text-sm font-medium">{m.email()}</span>
				<Input type="email" autocomplete="email" bind:value={email} required />
			</label>

			<Button type="submit" class="w-full" disabled={busy || !hydrated}>
				{m.magic_link_send()}
			</Button>
		</form>
	{/if}

	<a href={resolve('/login')} class="block text-sm text-link underline hover:text-link/80">
		{m.back_to_sign_in()}
	</a>
</div>
