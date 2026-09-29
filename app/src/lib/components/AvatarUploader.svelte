<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { AVATAR_MAX_BYTES, isAllowedAvatar } from '$lib/avatar';
	import Avatar from './Avatar.svelte';
	import * as m from '$lib/paraglide/messages';

	let {
		name,
		email,
		image,
		uploadEnabled,
		size = 64
	}: {
		name: string | null | undefined;
		email: string | null | undefined;
		image: string | null | undefined;
		uploadEnabled: boolean;
		size?: number;
	} = $props();

	let uploading = $state(false);
	let error = $state('');
	let fileInput = $state<HTMLInputElement>();

	async function onChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		error = '';
		if (!isAllowedAvatar(file)) {
			error =
				file.size > AVATAR_MAX_BYTES ? m.profile_avatar_too_large() : m.profile_avatar_bad_type();
			input.value = '';
			return;
		}
		uploading = true;
		try {
			const targetRes = await fetch('/app/settings/avatar', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ contentType: file.type, size: file.size })
			});
			if (!targetRes.ok) throw new Error('target');
			const { uploadUrl } = (await targetRes.json()) as { uploadUrl: string };
			const put = await fetch(uploadUrl, {
				method: 'PUT',
				body: file,
				headers: { 'content-type': file.type }
			});
			if (!put.ok) throw new Error('put');
			const confirm = await fetch('/app/settings/avatar', { method: 'PUT' });
			if (!confirm.ok) throw new Error('confirm');
			await invalidateAll();
		} catch {
			error = m.profile_avatar_failed();
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	async function remove() {
		error = '';
		uploading = true;
		try {
			const res = await authClient.updateUser({ image: '' });
			if (res.error) throw new Error(res.error.message);
			await invalidateAll();
		} catch {
			error = m.error_generic();
		} finally {
			uploading = false;
		}
	}
</script>

<div class="flex items-center gap-4">
	<Avatar {name} {email} {image} {size} />
	<div class="space-y-1">
		<div class="flex items-center gap-2">
			<button
				type="button"
				disabled={!uploadEnabled || uploading}
				onclick={() => fileInput?.click()}
				class="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground hover:border-foreground/40 disabled:opacity-50"
			>
				{uploading ? m.profile_avatar_uploading() : m.profile_avatar_upload()}
			</button>
			{#if image}
				<button
					type="button"
					disabled={uploading}
					onclick={remove}
					class="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
				>
					{m.profile_avatar_remove()}
				</button>
			{/if}
		</div>
		<p class="text-xs text-muted-foreground/70">
			{uploadEnabled ? m.profile_avatar_hint() : m.profile_avatar_unconfigured()}
		</p>
		{#if error}
			<p role="alert" class="text-xs text-destructive">{error}</p>
		{/if}
	</div>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/png,image/jpeg,image/webp"
		class="hidden"
		onchange={onChange}
	/>
</div>
