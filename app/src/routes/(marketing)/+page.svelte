<script lang="ts">
	import { Gauge, Lock, ShieldCheck } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import NewsletterSignup from '$lib/components/newsletter/NewsletterSignup.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import * as m from '$lib/paraglide/messages';
	import { organizationJsonLd, websiteJsonLd } from '$lib/utils/seo';

	const features = [
		{ icon: ShieldCheck, title: m.feature_auth_title, body: m.feature_auth_body },
		{ icon: Gauge, title: m.feature_speed_title, body: m.feature_speed_body },
		{ icon: Lock, title: m.feature_tested_title, body: m.feature_tested_body }
	];
</script>

<Seo description={m.landing_meta_description()} jsonLd={[websiteJsonLd(), organizationJsonLd()]} />

<section class="mx-auto max-w-3xl px-6 py-24 text-center">
	<h1 class="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
		{m.landing_hero_title()}
	</h1>
	<p class="mx-auto mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
		{m.landing_hero_subtitle()}
	</p>
	<div class="mt-10 flex flex-wrap items-center justify-center gap-3">
		<Button href={resolve('/signup')} size="lg">
			{m.get_started()}
		</Button>
		<Button href={resolve('/login')} variant="outline" size="lg">
			{m.sign_in()}
		</Button>
	</div>
</section>

<section class="border-t border-border bg-muted/50">
	<div class="mx-auto grid max-w-5xl gap-8 px-6 py-20 sm:grid-cols-3">
		{#each features as feature (feature.title)}
			<div class="space-y-3">
				<feature.icon class="h-6 w-6 text-link" aria-hidden="true" />
				<h2 class="font-semibold">{feature.title()}</h2>
				<p class="text-sm text-muted-foreground">{feature.body()}</p>
			</div>
		{/each}
	</div>
</section>

<section class="mx-auto max-w-3xl px-6 py-24 text-center">
	<h2 class="text-2xl font-semibold">{m.landing_cta_title()}</h2>
	<p class="mx-auto mt-4 max-w-lg text-muted-foreground">{m.landing_cta_body()}</p>
	<Button href={resolve('/signup')} size="lg" class="mt-8">
		{m.get_started()}
	</Button>
</section>

<section class="border-t border-border bg-muted/50">
	<div class="mx-auto max-w-md px-6 py-20 text-center">
		<h2 class="text-2xl font-semibold">{m.newsletter_heading()}</h2>
		<p class="mx-auto mt-4 text-muted-foreground">{m.newsletter_subtitle()}</p>
		<div class="mt-8">
			<NewsletterSignup />
		</div>
	</div>
</section>
