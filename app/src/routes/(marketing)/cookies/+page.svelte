<script lang="ts">
	import Seo from '$lib/components/seo/Seo.svelte';
	import * as m from '$lib/paraglide/messages';
	import LegalNotice from '../LegalNotice.svelte';
	import type { Section } from '../LegalDocument.svelte';

	const lastUpdated = '2026-07-14';

	const cookies = [
		{
			name: '__Secure-better-auth.session_token',
			purpose: 'Keeps you signed in. Without it, every page load would sign you out.',
			duration: '7 days',
			category: 'Strictly necessary'
		},
		{
			name: 'PARAGLIDE_LOCALE',
			purpose: 'Remembers the language you chose, so the site stays in it.',
			duration: '400 days',
			category: 'Strictly necessary (functional)'
		}
	];

	const sections: Section[] = [
		{
			heading: 'What cookies we set',
			body: [
				'We set two cookies. Both are strictly necessary to provide a service you have asked for: one keeps you signed in, the other remembers your language. They are listed in the table below.',
				'Over HTTPS the session cookie carries the __Secure- prefix and is HttpOnly and SameSite=Lax - it cannot be read by JavaScript and is not sent on cross-site requests. The language cookie is readable by JavaScript because the page needs it to render in your language.'
			]
		},
		{
			heading: 'Analytics and consent',
			body: [
				'Under the ePrivacy Directive and the GDPR, the two strictly-necessary cookies above do not require consent.',
				'If analytics is enabled, we use PostHog to understand how the product is used. It loads - and sets its cookies - only after you accept the consent banner; decline and nothing analytics-related runs. Clear the consent cookie to be asked again.'
			]
		},
		{
			heading: 'Controlling cookies',
			body: [
				'You can delete or block cookies in your browser settings. Blocking the session cookie will prevent you from signing in - the Service cannot work without it.'
			]
		},
		{
			heading: 'Contact',
			body: ['Questions about this page: [privacy@yourdomain].']
		}
	];
</script>

<Seo title={m.cookies_title()} description={m.cookies_meta_description()} />

<article class="mx-auto max-w-2xl space-y-8 px-6 py-16">
	<header class="space-y-2">
		<h1 class="text-3xl font-semibold">{m.cookies_title()}</h1>
		<p class="text-sm text-muted-foreground">{m.legal_last_updated({ date: lastUpdated })}</p>
	</header>

	<LegalNotice />

	{#each sections as section (section.heading)}
		<section class="space-y-3">
			<h2 class="text-lg font-semibold">{section.heading}</h2>
			{#each section.body as paragraph (paragraph)}
				<p class="text-muted-foreground">{paragraph}</p>
			{/each}
		</section>
	{/each}

	<section class="space-y-3">
		<h2 class="text-lg font-semibold">Cookie table</h2>
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-input">
					<tr>
						<th class="py-2 pr-4 font-semibold">Name</th>
						<th class="py-2 pr-4 font-semibold">Purpose</th>
						<th class="py-2 pr-4 font-semibold">Duration</th>
						<th class="py-2 font-semibold">Category</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each cookies as cookie (cookie.name)}
						<tr>
							<td class="py-2 pr-4 font-mono text-xs break-all">{cookie.name}</td>
							<td class="py-2 pr-4 text-muted-foreground">{cookie.purpose}</td>
							<td class="py-2 pr-4 whitespace-nowrap text-muted-foreground">{cookie.duration}</td>
							<td class="py-2 text-muted-foreground">{cookie.category}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</article>
