<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import AvatarUploader from '$lib/components/AvatarUploader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let name = $state(data.user.name);
	let saving = $state(false);
	let saved = $state(false);
	let error = $state('');

	async function saveProfile(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		saved = false;
		const trimmed = name.trim();
		if (!trimmed) {
			error = m.error_generic();
			return;
		}
		saving = true;
		const res = await authClient.updateUser({ name: trimmed });
		saving = false;
		if (res.error) {
			error = res.error.message ?? m.error_generic();
			return;
		}
		saved = true;
		await invalidateAll();
	}
</script>

<section class="space-y-6 pt-4">
	<div class="space-y-1">
		<h2 class="text-lg font-medium">{m.profile_title()}</h2>
		<p class="text-sm text-muted-foreground">{m.profile_tagline()}</p>
	</div>

	<AvatarUploader
		name={data.user.name}
		email={data.user.email}
		image={data.user.image}
		uploadEnabled={data.uploadEnabled}
	/>

	<form onsubmit={saveProfile} class="max-w-md space-y-4">
		<label class="block space-y-1">
			<span class="text-sm font-medium text-muted-foreground">{m.profile_name_label()}</span>
			<Input bind:value={name} required maxlength={100} />
		</label>
		{#if error}
			<p role="alert" class="text-sm text-destructive">{error}</p>
		{/if}
		{#if saved}
			<p role="status" class="text-sm text-success">{m.profile_saved()}</p>
		{/if}
		<Button type="submit" disabled={saving}>
			{m.profile_save()}
		</Button>
	</form>
</section>
