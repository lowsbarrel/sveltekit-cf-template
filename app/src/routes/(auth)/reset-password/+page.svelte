<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import * as m from '$lib/paraglide/messages';

	const token = $derived(page.url.searchParams.get('token'));
	const linkError = $derived(page.url.searchParams.get('error'));

	let password = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!token) return;
		busy = true;
		error = null;
		const result = await authClient.resetPassword({ newPassword: password, token });
		busy = false;
		if (result.error) {
			error = result.error.message ?? m.error_generic();
			return;
		}
		await goto(resolve('/login'));
	}
</script>

<Seo title={m.reset_password_title()} noindex />

<div class="space-y-6">
	<h1 class="text-2xl font-semibold">{m.reset_password_title()}</h1>

	{#if !token || linkError}
		<p role="alert" class="text-sm text-destructive">{m.reset_link_invalid()}</p>
		<a
			href={resolve('/forgot-password')}
			class="block text-sm text-link underline hover:text-link/80"
		>
			{m.forgot_password()}
		</a>
	{:else}
		<form onsubmit={submit} class="space-y-4">
			<label class="block">
				<span class="mb-1 block text-sm font-medium">{m.new_password()}</span>
				<Input
					type="password"
					autocomplete="new-password"
					bind:value={password}
					required
					minlength={8}
				/>
			</label>

			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}

			<Button type="submit" class="w-full" disabled={busy || !hydrated}>
				{m.update_password()}
			</Button>
		</form>
	{/if}

	<a href={resolve('/login')} class="block text-sm text-link underline hover:text-link/80">
		{m.back_to_sign_in()}
	</a>
</div>
