<script lang="ts">
	import { onMount } from 'svelte';
	import Turnstile from '$lib/components/Turnstile.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import * as m from '$lib/paraglide/messages';

	let email = $state('');
	let captchaToken = $state('');
	let siteKey = $state<string | null>(null);
	let ready = $state(false);
	let busy = $state(false);
	let done = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const res = await fetch('/api/newsletter/subscribe');
			const data = (await res.json()) as { turnstileSiteKey: string | null };
			siteKey = data.turnstileSiteKey;
		} catch {
			siteKey = null;
		} finally {
			ready = true;
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		try {
			const res = await fetch('/api/newsletter/subscribe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email, turnstileToken: captchaToken || undefined })
			});
			if (!res.ok) {
				error = m.newsletter_error();
				return;
			}
			done = true;
		} catch {
			error = m.newsletter_error();
		} finally {
			busy = false;
		}
	}
</script>

{#if done}
	<p role="status" class="text-sm text-muted-foreground">{m.newsletter_success()}</p>
{:else}
	<form onsubmit={submit} class="space-y-4">
		<label class="block text-left">
			<span class="mb-1 block text-sm font-medium">{m.newsletter_email_label()}</span>
			<Input type="email" autocomplete="email" bind:value={email} required />
		</label>

		{#if siteKey}
			<Turnstile {siteKey} bind:token={captchaToken} />
		{/if}

		{#if error}
			<p role="alert" class="text-sm text-destructive">{error}</p>
		{/if}

		<Button type="submit" class="w-full" disabled={busy || !ready || (!!siteKey && !captchaToken)}>
			{m.newsletter_submit()}
		</Button>
	</form>
{/if}
