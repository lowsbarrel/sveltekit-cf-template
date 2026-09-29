<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { safeNext } from '$lib/utils/redirect';
	import * as m from '$lib/paraglide/messages';
	import SocialSignIn from '../SocialSignIn.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const next = $derived(safeNext(page.url.searchParams.get('next')));
	const loginHref = $derived(
		next === '/app' ? resolve('/login') : resolve(`/login?next=${encodeURIComponent(next)}`)
	);
	const verifyCallback = $derived(
		next === '/app' ? '/verify-email' : `/verify-email?next=${encodeURIComponent(next)}`
	);

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let captchaToken = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);
	let awaitingVerification = $state(false);

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		const result = await authClient.signUp.email(
			{ name, email, password, callbackURL: verifyCallback },
			captchaToken ? { headers: { 'x-captcha-response': captchaToken } } : undefined
		);
		busy = false;
		if (result.error) {
			error = result.error.message ?? m.error_generic();
			return;
		}

		if (data.methods.email) {
			awaitingVerification = true;
			return;
		}
		await goto(next, { invalidateAll: true });
	}
</script>

<Seo title={m.sign_up()} noindex />

<div class="space-y-6">
	<h1 class="text-2xl font-semibold">{m.create_account()}</h1>

	{#if awaitingVerification}
		<p role="status" class="text-sm text-muted-foreground">{m.verify_email_sent({ email })}</p>
		<a href={resolve('/login')} class="block text-sm text-link underline hover:text-link/80">
			{m.back_to_sign_in()}
		</a>
	{:else}
		{#if data.methods.google}
			<SocialSignIn callbackURL={next} />
		{/if}

		<form onsubmit={submit} class="space-y-4">
			<label class="block">
				<span class="mb-1 block text-sm font-medium">{m.name()}</span>
				<Input autocomplete="name" bind:value={name} required />
			</label>
			<label class="block">
				<span class="mb-1 block text-sm font-medium">{m.email()}</span>
				<Input type="email" autocomplete="email" bind:value={email} required />
			</label>
			<label class="block">
				<span class="mb-1 block text-sm font-medium">{m.password()}</span>
				<Input
					type="password"
					autocomplete="new-password"
					bind:value={password}
					required
					minlength={8}
				/>
			</label>

			{#if data.turnstileSiteKey}
				<Turnstile siteKey={data.turnstileSiteKey} bind:token={captchaToken} />
			{/if}

			{#if error}
				<p role="alert" class="text-sm text-destructive">{error}</p>
			{/if}

			<Button
				type="submit"
				class="w-full"
				disabled={busy || !hydrated || (!!data.turnstileSiteKey && !captchaToken)}
			>
				{m.sign_up()}
			</Button>
		</form>

		<a href={loginHref} class="block text-sm text-link underline hover:text-link/80">
			{m.have_account()}
		</a>
	{/if}
</div>
