<script lang="ts">
	import { KeyRound } from '@lucide/svelte';
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
	const signupHref = $derived(
		next === '/app' ? resolve('/signup') : resolve(`/signup?next=${encodeURIComponent(next)}`)
	);
	const twofaHref = $derived(
		next === '/app' ? resolve('/2fa') : resolve(`/2fa?next=${encodeURIComponent(next)}`)
	);

	let email = $state('');
	let password = $state('');
	let captchaToken = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		const result = await authClient.signIn.email(
			{ email, password },
			captchaToken ? { headers: { 'x-captcha-response': captchaToken } } : undefined
		);
		busy = false;
		if (result.error) {
			error = result.error.message ?? m.error_generic();
			return;
		}
		if (result.data && 'twoFactorRedirect' in result.data && result.data.twoFactorRedirect) {
			await goto(twofaHref);
			return;
		}
		await goto(next, { invalidateAll: true });
	}

	async function signInWithPasskey() {
		error = null;
		const res = await authClient.signIn.passkey();
		if (res?.error) {
			error = res.error.message ?? m.error_generic();
			return;
		}
		await goto(next, { invalidateAll: true });
	}
</script>

<Seo title={m.sign_in()} noindex />

<div class="space-y-6">
	<h1 class="text-2xl font-semibold">{m.sign_in()}</h1>

	{#if data.methods.google}
		<SocialSignIn callbackURL={next} />
	{/if}

	<form onsubmit={submit} class="space-y-4">
		<label class="block">
			<span class="mb-1 block text-sm font-medium">{m.email()}</span>
			<Input type="email" autocomplete="email" bind:value={email} required />
		</label>
		<label class="block">
			<span class="mb-1 block text-sm font-medium">{m.password()}</span>
			<Input type="password" autocomplete="current-password" bind:value={password} required />
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
			{m.sign_in()}
		</Button>
	</form>

	<Button
		type="button"
		variant="outline"
		class="w-full"
		onclick={signInWithPasskey}
		disabled={!hydrated}
	>
		<KeyRound class="h-4 w-4" />
		{m.signin_passkey()}
	</Button>

	<div class="flex flex-col gap-2 text-sm">
		{#if data.methods.email}
			<a href={resolve('/magic-link')} class="text-link underline hover:text-link/80">
				{m.magic_link_cta()}
			</a>
			<a href={resolve('/forgot-password')} class="text-link underline hover:text-link/80">
				{m.forgot_password()}
			</a>
		{/if}
		<a href={signupHref} class="text-link underline hover:text-link/80">
			{m.need_account()}
		</a>
	</div>
</div>
