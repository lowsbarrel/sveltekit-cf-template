<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { enhance as toggleEnhance } from '$app/forms';
	import { superForm } from 'sveltekit-superforms';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, message, enhance, submitting } = superForm(data.form, {
		resetForm: true
	});
</script>

<Seo title={m.app_title()} noindex />

<main class="mx-auto max-w-xl space-y-8 p-4 sm:p-8">
	<header class="space-y-2">
		<h1 class="text-2xl font-semibold">{m.app_title()}</h1>
		<p class="text-sm text-muted-foreground">{m.app_tagline()}</p>
	</header>

	<form method="POST" action="?/add" use:enhance class="flex items-start gap-2">
		<label class="flex-1">
			<span class="sr-only">{m.title_label()}</span>
			<Input
				name="title"
				aria-label={m.title_label()}
				placeholder={m.todo_placeholder()}
				aria-invalid={$errors.title ? 'true' : undefined}
				bind:value={$form.title}
			/>
			{#if $errors.title}
				<span class="mt-1 block text-sm text-destructive">{$errors.title}</span>
			{/if}
		</label>
		<Button type="submit" disabled={$submitting}>
			{m.add()}
		</Button>
	</form>

	{#if $message}
		<p role="status" class="text-sm text-success">{$message}</p>
	{/if}

	<ul class="divide-y divide-border">
		{#each data.todos as todo (todo.id)}
			<li class="flex items-center gap-3 py-2">
				<form method="POST" action="?/toggle" use:toggleEnhance>
					<input type="hidden" name="id" value={todo.id} />
					<input type="hidden" name="done" value={String(!todo.done)} />
					<button
						type="submit"
						aria-label={todo.done ? m.todo_mark_not_done() : m.todo_mark_done()}
						class="flex h-5 w-5 items-center justify-center rounded border border-input text-link hover:border-primary-500"
					>
						{#if todo.done}
							<Check class="h-3.5 w-3.5" strokeWidth={3} />
						{/if}
					</button>
				</form>
				<span class:line-through={todo.done}>{todo.title}</span>
			</li>
		{:else}
			<li class="py-2 text-sm text-muted-foreground">{m.nothing_yet()}</li>
		{/each}
	</ul>
</main>
