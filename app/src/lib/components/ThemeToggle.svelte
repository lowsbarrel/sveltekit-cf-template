<script lang="ts">
	import { Check, Monitor, Moon, Sun } from '@lucide/svelte';
	import { getTheme, setTheme, watchSystemTheme, type Theme } from '$lib/theme.svelte';
	import * as m from '$lib/paraglide/messages';

	watchSystemTheme();

	let open = $state(false);

	const options: { value: Theme; label: () => string; icon: typeof Sun }[] = [
		{ value: 'light', label: m.theme_light, icon: Sun },
		{ value: 'dark', label: m.theme_dark, icon: Moon },
		{ value: 'system', label: m.theme_system, icon: Monitor }
	];

	const active = $derived(getTheme());

	function choose(value: Theme) {
		setTheme(value);
		open = false;
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-label={m.theme_toggle()}
		aria-expanded={open}
		class="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
	>
		{#if active === 'light'}
			<Sun class="h-5 w-5" aria-hidden="true" />
		{:else if active === 'dark'}
			<Moon class="h-5 w-5" aria-hidden="true" />
		{:else}
			<Monitor class="h-5 w-5" aria-hidden="true" />
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
			class="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg"
		>
			{#each options as option (option.value)}
				<button
					type="button"
					onclick={() => choose(option.value)}
					class="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
				>
					<span class="flex items-center gap-2">
						<option.icon class="h-4 w-4" aria-hidden="true" />
						{option.label()}
					</span>
					{#if active === option.value}
						<Check class="h-4 w-4 shrink-0 text-link" aria-hidden="true" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
