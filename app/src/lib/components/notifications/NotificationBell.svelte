<script lang="ts">
	import { Bell } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import {
		markAllRead,
		markRead,
		notifications,
		renderNotification
	} from '$lib/notifications.svelte';
	import { type Notif } from '$lib/notifications';
	import { safeNext } from '$lib/utils/redirect';
	import * as m from '$lib/paraglide/messages';

	let open = $state(false);

	async function openItem(n: Notif) {
		open = false;
		if (!n.readAt) await markRead(n.id);
		if (n.href) await goto(safeNext(n.href));
	}
</script>

<div class="relative">
	<button
		onclick={() => (open = !open)}
		aria-label={m.notifications_title()}
		aria-expanded={open}
		class="relative rounded-full p-2 text-muted-foreground hover:bg-muted/50 focus:ring-2 focus:ring-primary-500 focus:outline-none"
	>
		<Bell class="h-5 w-5" />
		{#if notifications.unread > 0}
			<span
				class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white"
			>
				{notifications.unread > 9 ? '9+' : notifications.unread}
			</span>
		{/if}
	</button>

	{#if open}
		<button
			class="fixed inset-0 z-10 cursor-default"
			tabindex="-1"
			aria-hidden="true"
			onclick={() => (open = false)}
		></button>
		<div
			class="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
		>
			<div class="flex items-center justify-between border-b border-border px-4 py-2">
				<span class="text-sm font-medium text-foreground">{m.notifications_title()}</span>
				{#if notifications.unread > 0}
					<button onclick={markAllRead} class="text-xs text-link hover:text-link/80">
						{m.notifications_mark_all_read()}
					</button>
				{/if}
			</div>
			<ul class="max-h-96 divide-y divide-border overflow-y-auto">
				{#each notifications.items as n (n.id)}
					<li>
						<button
							onclick={() => openItem(n)}
							class="block w-full px-4 py-3 text-left hover:bg-muted/50 {n.readAt
								? ''
								: 'bg-primary-500/5'}"
						>
							<p class="text-sm text-foreground">{renderNotification(n)}</p>
							<time class="text-xs text-muted-foreground/70"
								>{new Date(n.createdAt).toLocaleString()}</time
							>
						</button>
					</li>
				{:else}
					<li class="px-4 py-6 text-center text-sm text-muted-foreground">
						{m.notifications_empty()}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
