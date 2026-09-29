<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Seo from '$lib/components/seo/Seo.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const tabs = [
		{ href: resolve('/app/settings/profile'), label: m.settings_nav_profile() },
		{ href: resolve('/app/settings/account'), label: m.settings_nav_account() },
		{ href: resolve('/app/settings/security'), label: m.settings_nav_security() },
		{ href: resolve('/app/settings/sessions'), label: m.settings_nav_sessions() },
		{ href: resolve('/app/settings/danger'), label: m.settings_nav_danger() }
	];
</script>

<Seo title={m.settings_title()} noindex />

<main class="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
	<h1 class="text-2xl font-semibold">{m.settings_title()}</h1>

	<nav class="flex flex-wrap gap-1 border-b border-border">
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				aria-current={page.url.pathname === tab.href ? 'page' : undefined}
				class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors {page.url
					.pathname === tab.href
					? 'border-primary-600 text-link'
					: 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				{tab.label}
			</a>
		{/each}
	</nav>

	{@render children()}
</main>
