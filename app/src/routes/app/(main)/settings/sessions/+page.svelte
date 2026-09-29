<script lang="ts">
	import { Monitor } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const others = $derived(data.sessions.filter((s) => s.id !== data.currentSessionId));

	function deviceLabel(ua: string | null): string {
		if (!ua) return m.sessions_unknown_device();
		const browser = /Firefox/.test(ua)
			? 'Firefox'
			: /Edg/.test(ua)
				? 'Edge'
				: /Chrome/.test(ua)
					? 'Chrome'
					: /Safari/.test(ua)
						? 'Safari'
						: 'Browser';
		const os = /Windows/.test(ua)
			? 'Windows'
			: /Mac OS/.test(ua)
				? 'macOS'
				: /Android/.test(ua)
					? 'Android'
					: /iPhone|iPad/.test(ua)
						? 'iOS'
						: /Linux/.test(ua)
							? 'Linux'
							: '';
		return os ? `${browser} · ${os}` : browser;
	}
</script>

<section class="space-y-6 pt-4">
	<div class="space-y-1">
		<h2 class="text-lg font-medium">{m.sessions_title()}</h2>
		<p class="text-sm text-muted-foreground">{m.sessions_tagline()}</p>
	</div>

	<ul class="divide-y divide-border rounded-lg border border-border">
		{#each data.sessions as s (s.id)}
			{@const isCurrent = s.id === data.currentSessionId}
			<li class="flex items-center justify-between gap-4 px-4 py-3">
				<div class="flex min-w-0 items-center gap-3">
					<Monitor class="h-5 w-5 shrink-0 text-muted-foreground/70" />
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-foreground">
							{deviceLabel(s.userAgent)}
							{#if isCurrent}
								<span class="ml-1 rounded bg-success/10 px-1.5 py-0.5 text-xs text-success">
									{m.sessions_current()}
								</span>
							{/if}
						</p>
						<p class="truncate text-xs text-muted-foreground">
							{s.ipAddress ?? ''}
							{s.ipAddress ? '· ' : ''}{m.sessions_last_active({
								date: new Date(s.updatedAt).toLocaleString()
							})}
						</p>
					</div>
				</div>
				{#if !isCurrent}
					<form method="POST" action="?/revoke" use:enhance>
						<input type="hidden" name="id" value={s.id} />
						<Button type="submit" variant="outline" size="sm" class="shrink-0">
							{m.sessions_revoke()}
						</Button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>

	{#if others.length > 0}
		<form method="POST" action="?/revokeOthers" use:enhance>
			<Button type="submit" variant="outline">
				{m.sessions_revoke_others()}
			</Button>
		</form>
	{:else}
		<p class="text-sm text-muted-foreground">{m.sessions_empty()}</p>
	{/if}
</section>
