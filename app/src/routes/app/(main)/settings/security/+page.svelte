<script lang="ts">
	import { KeyRound, Trash2 } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const enabled = $derived(!!data.user.twoFactorEnabled);

	let error = $state('');

	let password = $state('');
	let busy = $state(false);
	let setup = $state<{ secret: string; backupCodes: string[] } | null>(null);
	let qr = $state('');
	let code = $state('');

	async function enable(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		const res = await authClient.twoFactor.enable({ password });
		busy = false;
		password = '';
		if (res.error || !res.data) {
			error = res.error?.message ?? m.error_generic();
			return;
		}
		const secret = new URLSearchParams(res.data.totpURI.split('?')[1]).get('secret') ?? '';
		setup = { secret, backupCodes: res.data.backupCodes };
		const QRCode = (await import('qrcode')).default;
		qr = await QRCode.toDataURL(res.data.totpURI);
	}

	async function verify(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		const res = await authClient.twoFactor.verifyTotp({ code: code.trim() });
		busy = false;
		if (res.error) {
			error = res.error.message ?? m.error_generic();
			return;
		}
		setup = null;
		code = '';
		await invalidateAll();
	}

	let disablePassword = $state('');
	async function disable(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		const res = await authClient.twoFactor.disable({ password: disablePassword });
		busy = false;
		disablePassword = '';
		if (res.error) {
			error = res.error.message ?? m.error_generic();
			return;
		}
		await invalidateAll();
	}

	let passkeyName = $state('');
	let addingPasskey = $state(false);
	let passkeyError = $state('');
	async function addPasskey(e: SubmitEvent) {
		e.preventDefault();
		passkeyError = '';
		addingPasskey = true;
		const res = await authClient.passkey.addPasskey({ name: passkeyName.trim() || undefined });
		addingPasskey = false;
		if (res?.error) {
			passkeyError = res.error.message ?? m.error_generic();
			return;
		}
		passkeyName = '';
		await invalidateAll();
	}
</script>

<section class="space-y-10 pt-4">
	<div class="max-w-md space-y-4">
		<div class="space-y-1">
			<h2 class="text-lg font-medium">{m.security_2fa_title()}</h2>
			<p class="text-sm text-muted-foreground">{m.security_2fa_desc()}</p>
		</div>

		{#if error}
			<p role="alert" class="text-sm text-destructive">{error}</p>
		{/if}

		{#if enabled}
			<p class="rounded border border-success/30 bg-success/10 p-3 text-sm text-success">
				{m.security_2fa_enabled()}
			</p>
			<form onsubmit={disable} class="space-y-3">
				<label class="block space-y-1">
					<span class="text-sm font-medium text-muted-foreground"
						>{m.security_2fa_password_label()}</span
					>
					<Input
						type="password"
						bind:value={disablePassword}
						required
						autocomplete="current-password"
					/>
				</label>
				<Button type="submit" variant="outline" disabled={busy}>
					{m.security_2fa_disable()}
				</Button>
			</form>
		{:else if setup}
			<div class="space-y-4 rounded-lg border border-border p-4">
				<p class="text-sm text-muted-foreground">{m.security_2fa_scan()}</p>
				{#if qr}
					<img src={qr} alt="" class="h-44 w-44" />
				{/if}
				<div class="space-y-1">
					<span class="text-xs text-muted-foreground">{m.security_2fa_secret_label()}</span>
					<code class="block rounded bg-muted px-2 py-1 font-mono text-sm break-all">
						{setup.secret}
					</code>
				</div>
				<div class="space-y-1">
					<p class="text-sm font-medium">{m.security_2fa_backup_title()}</p>
					<p class="text-xs text-muted-foreground">{m.security_2fa_backup_desc()}</p>
					<ul class="mt-1 grid grid-cols-2 gap-1 rounded bg-muted/50 p-2 font-mono text-sm">
						{#each setup.backupCodes as bc (bc)}
							<li>{bc}</li>
						{/each}
					</ul>
				</div>
				<form onsubmit={verify} class="space-y-2">
					<label class="block space-y-1">
						<span class="text-sm font-medium text-muted-foreground"
							>{m.security_2fa_verify_label()}</span
						>
						<Input
							bind:value={code}
							inputmode="numeric"
							autocomplete="one-time-code"
							required
							class="tracking-widest"
						/>
					</label>
					<Button type="submit" disabled={busy}>
						{m.security_2fa_verify()}
					</Button>
				</form>
			</div>
		{:else if data.hasPassword}
			<form onsubmit={enable} class="space-y-3">
				<label class="block space-y-1">
					<span class="text-sm font-medium text-muted-foreground"
						>{m.security_2fa_password_label()}</span
					>
					<Input type="password" bind:value={password} required autocomplete="current-password" />
				</label>
				<Button type="submit" disabled={busy}>
					{m.security_2fa_enable()}
				</Button>
			</form>
		{:else}
			<p class="text-sm text-muted-foreground">{m.security_2fa_needs_password()}</p>
		{/if}
	</div>

	<div class="max-w-md space-y-4">
		<div class="space-y-1">
			<h2 class="text-lg font-medium">{m.security_passkey_title()}</h2>
			<p class="text-sm text-muted-foreground">{m.security_passkey_desc()}</p>
		</div>

		{#if data.passkeys.length > 0}
			<ul class="divide-y divide-border rounded-lg border border-border">
				{#each data.passkeys as pk (pk.id)}
					<li class="flex items-center justify-between gap-3 px-4 py-3">
						<div class="flex min-w-0 items-center gap-3">
							<KeyRound class="h-5 w-5 shrink-0 text-muted-foreground/70" />
							<div class="min-w-0">
								<p class="truncate text-sm font-medium text-foreground">
									{pk.name || pk.deviceType}
								</p>
								<p class="text-xs text-muted-foreground">
									{m.security_passkey_added({ date: new Date(pk.createdAt).toLocaleDateString() })}
								</p>
							</div>
						</div>
						<form method="POST" action="?/deletePasskey" use:enhance>
							<input type="hidden" name="id" value={pk.id} />
							<button
								type="submit"
								aria-label={m.security_passkey_delete()}
								class="rounded p-1.5 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">{m.security_passkey_none()}</p>
		{/if}

		{#if passkeyError}
			<p role="alert" class="text-sm text-destructive">{passkeyError}</p>
		{/if}
		<form onsubmit={addPasskey} class="flex items-end gap-2">
			<label class="min-w-0 flex-1 space-y-1">
				<span class="text-sm font-medium text-muted-foreground"
					>{m.security_passkey_name_label()}</span
				>
				<Input bind:value={passkeyName} maxlength={60} />
			</label>
			<Button type="submit" disabled={addingPasskey}>
				{m.security_passkey_add()}
			</Button>
		</form>
	</div>
</section>
