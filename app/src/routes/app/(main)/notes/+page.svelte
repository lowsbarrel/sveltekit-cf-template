<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import { enhance as deleteEnhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { superForm } from 'sveltekit-superforms';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import * as m from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, message, enhance, submitting } = superForm(data.form, {
		resetForm: true
	});
</script>

<Seo title={m.notes_title()} noindex />

<main class="mx-auto max-w-xl space-y-8 p-4 sm:p-8">
	<header class="space-y-2">
		<a href={resolve('/app')} class="text-sm text-link underline hover:text-link/80">
			{m.notes_back_to_app()}
		</a>
		<h1 class="text-2xl font-semibold">{m.notes_title()}</h1>
		<p class="text-sm text-muted-foreground">{m.notes_tagline()}</p>
	</header>

	<form method="POST" action="?/create" use:enhance class="space-y-2">
		<label class="block">
			<span class="sr-only">{m.note_title_label()}</span>
			<Input
				name="title"
				aria-label={m.note_title_label()}
				placeholder={m.note_title_placeholder()}
				aria-invalid={$errors.title ? 'true' : undefined}
				bind:value={$form.title}
			/>
			{#if $errors.title}
				<span class="mt-1 block text-sm text-destructive">{$errors.title}</span>
			{/if}
		</label>
		<label class="block">
			<span class="sr-only">{m.note_body_label()}</span>
			<Textarea
				name="body"
				aria-label={m.note_body_label()}
				placeholder={m.note_body_placeholder()}
				bind:value={$form.body}
				rows={3}
			/>
		</label>
		<Button type="submit" disabled={$submitting}>
			{m.note_add()}
		</Button>
	</form>

	{#if $message}
		<p role="status" class="text-sm text-success">{$message}</p>
	{/if}

	<ul class="divide-y divide-border">
		{#each data.notes as note (note.id)}
			<li class="flex items-start justify-between gap-3 py-3">
				<div class="min-w-0 space-y-1">
					<p class="font-medium">{note.title}</p>
					{#if note.body}
						<p class="text-sm wrap-break-word whitespace-pre-wrap text-muted-foreground">
							{note.body}
						</p>
					{/if}
				</div>
				<form method="POST" action="?/delete" use:deleteEnhance>
					<input type="hidden" name="id" value={note.id} />
					<button
						type="submit"
						aria-label={m.note_delete()}
						class="text-muted-foreground/70 hover:text-destructive"
					>
						<Trash2 class="h-4 w-4" />
					</button>
				</form>
			</li>
		{:else}
			<li class="py-2 text-sm text-muted-foreground">{m.notes_empty()}</li>
		{/each}
	</ul>
</main>
