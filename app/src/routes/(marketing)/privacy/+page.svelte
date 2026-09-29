<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import LegalDocument from '../LegalDocument.svelte';
	import type { Section } from '../LegalDocument.svelte';

	const lastUpdated = '2026-07-14';

	const sections: Section[] = [
		{
			heading: '1. Who is responsible for your data',
			body: [
				'[Company Legal Name], [registered address], is the data controller for the personal data described here. For privacy questions, contact [privacy@yourdomain].',
				'Creem, our payment provider, acts as Merchant of Record. For payment data it is an independent controller, not our processor: it decides how it handles card data and tax records, under its own privacy policy. We never see or store your card details.'
			]
		},
		{
			heading: '2. What we collect',
			body: [
				'Account data: your name, your email address, and a hash of your password. We store the hash using scrypt with a random per-user salt; we never store the password itself and cannot recover it.',
				'Session data: each time you sign in we store a session token, its expiry, your IP address, and your browser user agent. We use these to keep you signed in, to show you where your account is being used, and to detect abuse.',
				"Organization data: the organizations you belong to, your role in each, and any invitations you send - which include the invitee's email address, even if they never sign up.",
				"Billing data: if your organization subscribes, we store Creem's identifiers (customer id, subscription id, product id), the subscription status, and when the current period ends. We do not store card numbers, billing addresses, or tax details - Creem holds those.",
				'Security data: a rate-limiting counter keyed on your IP address, used to throttle repeated sign-in and sign-up attempts.',
				'Content: whatever you create in the Service.'
			]
		},
		{
			heading: '3. Why we use it, and our legal basis',
			body: [
				'To provide the Service and to authenticate you - this is necessary to perform our contract with you.',
				'To prevent abuse and secure the Service, including rate limiting and storing session IP addresses - this is our legitimate interest in keeping the Service available and safe.',
				'To take payment and give your organization access to paid features - necessary to perform our contract.',
				'To send you transactional email, such as a password reset - necessary to perform our contract. We do not send marketing email [unless you opt in].'
			]
		},
		{
			heading: '4. Who else processes your data',
			body: [
				'Cloudflare, Inc. hosts the Service. Our code runs on Cloudflare Workers, database connections are pooled through Cloudflare Hyperdrive, and our application logs go to Cloudflare Workers Logs. Cloudflare therefore processes your IP address and request metadata on our behalf.',
				'[Neon / your Postgres provider] hosts our database, in [region]. This is where the account, session, organization, and billing records above are stored.',
				'Creem handles payments as Merchant of Record, and receives your email address and the amount you pay so it can charge you, invoice you, and remit tax.',
				'[If you enable the email binding: Cloudflare Email Service delivers our transactional email and processes recipient addresses.]',
				'[If you enable PostHog analytics: PostHog processes product-usage events; it loads, and sets its cookies, only after you accept the consent banner, and declining runs nothing analytics-related.]',
				'We use no advertising or session-recording services.'
			]
		},
		{
			heading: '5. Where your data goes',
			body: [
				'Cloudflare Workers runs at edge locations worldwide, so a request may be processed in the region closest to you. Our database is in a fixed region, [region], and that is where your data rests.',
				'Where data leaves the [EEA/UK], it is transferred under the [Standard Contractual Clauses / adequacy decision] relied on by the relevant provider.'
			]
		},
		{
			heading: '6. How long we keep it',
			body: [
				'Expired sessions and expired password-reset tokens are deleted automatically by a job that runs every day at 03:00 UTC. Sessions expire after [7] days, so the IP address and user agent attached to a session are removed within roughly a day of that.',
				'Account, organization, and content data is kept for as long as your account exists. When your account is deleted, your sessions, sign-in credentials, memberships, invitations you sent, and content are deleted with it.',
				'Billing and tax records are kept by Creem for as long as tax law requires, typically [7-10] years. We cannot delete those on request.'
			]
		},
		{
			heading: '7. Your rights',
			body: [
				'If the GDPR or UK GDPR applies to you, you may request access to your data, correction, deletion, a portable copy, restriction of processing, and you may object to processing based on legitimate interests. Where we rely on consent, you may withdraw it at any time.',
				'Write to [privacy@yourdomain] and we will respond within one month. You may also complain to your local data protection authority - [name the supervisory authority for your establishment, e.g. the Irish DPC or the UK ICO].'
			]
		},
		{
			heading: '8. How we protect it',
			body: [
				'Passwords are hashed with scrypt. Session cookies are HttpOnly, SameSite=Lax, and Secure over HTTPS, so they cannot be read by JavaScript. All traffic is HTTPS, and we send HSTS so browsers refuse to downgrade.',
				'We rate-limit authentication endpoints in the database, so the limit holds across every edge location rather than per server. Database queries are parameterized, and errors returned to you never include internal details.',
				'No system is perfectly secure and we do not claim any certification we do not hold.'
			]
		},
		{
			heading: '9. Children',
			body: [
				'The Service is not for children under [16]. We do not knowingly collect their data, and will delete an account we learn belongs to one.'
			]
		},
		{
			heading: '10. Changes',
			body: [
				'If we change this policy materially we will tell you by email or in the Service before the change takes effect. The date at the top always reflects the current version.'
			]
		},
		{
			heading: '11. Contact',
			body: [
				'[Company Legal Name], [registered address]. Email: [privacy@yourdomain]. [Add your Data Protection Officer or EU representative here if you are required to appoint one.]'
			]
		}
	];
</script>

<LegalDocument
	title={m.privacy_title()}
	description={m.privacy_meta_description()}
	{lastUpdated}
	{sections}
/>
