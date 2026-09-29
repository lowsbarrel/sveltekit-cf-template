<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/Button.svelte';
	import * as m from '$lib/paraglide/messages';

	let { callbackURL = '/app' }: { callbackURL?: string } = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	async function google() {
		busy = true;
		error = null;
		const result = await authClient.signIn.social({ provider: 'google', callbackURL });
		if (result?.error) {
			busy = false;
			error = result.error.message ?? m.error_generic();
		}
	}
</script>

<div class="space-y-3">
	<Button type="button" variant="outline" class="w-full gap-3" onclick={google} disabled={busy}>
		<svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
			/>
			<path
				fill="#FBBC05"
				d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
			/>
			<path
				fill="#EA4335"
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z"
			/>
		</svg>
		{m.continue_with_google()}
	</Button>

	{#if error}
		<p role="alert" class="text-sm text-destructive">{error}</p>
	{/if}

	<div class="flex items-center gap-3 text-xs text-muted-foreground/70">
		<span class="h-px flex-1 bg-border"></span>
		{m.or()}
		<span class="h-px flex-1 bg-border"></span>
	</div>
</div>
