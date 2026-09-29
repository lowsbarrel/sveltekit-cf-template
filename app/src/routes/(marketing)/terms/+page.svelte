<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import LegalDocument from '../LegalDocument.svelte';
	import type { Section } from '../LegalDocument.svelte';

	const lastUpdated = '2026-07-14';

	const sections: Section[] = [
		{
			heading: '1. Who you are contracting with',
			body: [
				'The Service is operated by [Company Legal Name], registered in [country] at [registered address] ("we", "us"). These Terms govern your use of the Service.',
				"Payments are separate. Our payment provider, Creem, acts as the Merchant of Record. Creem - not us - is the seller of record for every purchase: Creem takes your payment, issues your invoice, and is the counterparty to the payment transaction. Creem's own terms apply to that transaction alongside these Terms.",
				'By creating an account you agree to these Terms. If you accept them for an organization, you confirm you are authorized to bind it, and "you" means that organization.'
			]
		},
		{
			heading: '2. The Service',
			body: [
				'The Service is [one sentence describing what the product does]. We may change, add, or remove features. If a change materially reduces what a paid plan does, we will tell you in advance and you may cancel.',
				'We do not promise the Service will be uninterrupted or error-free, and we offer no service level agreement unless we have agreed one with you in writing.'
			]
		},
		{
			heading: '3. Accounts and organizations',
			body: [
				'You must be at least [16] years old and provide accurate registration details. You are responsible for keeping your password safe and for everything done through your account.',
				"When you sign up we create an organization for you and make you its owner. You may invite others into it. Members hold a role - owner, admin, or member - and that role decides what they can do, including who may change the organization's plan.",
				'Tell us promptly at [security@yourdomain] if you believe your account has been accessed without your permission.'
			]
		},
		{
			heading: '4. Acceptable use',
			body: [
				"You may not use the Service to break the law, infringe anyone's rights, or store or transmit malware. You may not reverse engineer it, resell it, scrape it, circumvent its rate limits, or attempt to reach data belonging to another organization.",
				'We may suspend or terminate an account that breaches this section, and may do so without notice where the breach is serious.'
			]
		},
		{
			heading: '5. Plans, billing, and tax',
			body: [
				'Subscriptions are per organization, not per person: one plan covers every member. Only an owner or admin may start, change, or cancel it.',
				"Plans renew automatically each billing period until cancelled. You may cancel at any time from the billing page, which opens Creem's customer portal. Cancelling stops the next renewal; your access continues to the end of the period you have already paid for.",
				'Prices are shown exclusive of tax unless stated otherwise. Because Creem is the Merchant of Record, Creem determines, collects, and remits any VAT, GST, or sales tax due on your purchase according to where you are. The tax shown at checkout is the tax you pay.',
				'If a payment fails, Creem retries it. If it continues to fail the subscription becomes past due and paid features stop working until payment succeeds.'
			]
		},
		{
			heading: '6. Refunds and chargebacks',
			body: [
				'Refunds are handled by Creem as seller of record, under [state your refund policy - for example, a 14-day refund on request for first-time purchases]. Request one at [support@yourdomain] and we will pass it to Creem, or contact Creem directly.',
				'Any statutory right of withdrawal you have - for example the 14-day right for consumers in the EU - applies regardless of this section, and nothing here removes it.',
				'Raising a chargeback with your bank instead of contacting us may lead to your account being suspended while the dispute is resolved.'
			]
		},
		{
			heading: '7. Your content',
			body: [
				'Anything you put into the Service stays yours. You grant us only the licence we need to operate the Service for you: to store, process, transmit, display, and back up your content.',
				'You are responsible for having the right to upload what you upload. We do not routinely review content, but may remove content we believe breaches these Terms or the law.'
			]
		},
		{
			heading: '8. Our intellectual property',
			body: [
				'The Service, its software, and its branding remain ours. These Terms grant you a limited, non-exclusive, non-transferable right to use the Service and nothing more.'
			]
		},
		{
			heading: '9. Termination',
			body: [
				"You may stop using the Service and delete your account at any time. We may suspend or terminate your account if you breach these Terms, or on [30] days' notice for any other reason, in which case we will refund the unused portion of any prepaid period.",
				'When an account is deleted we delete the personal data associated with it as described in the Privacy Policy. Records we are required to keep for legal or accounting reasons - including transaction records held by Creem - are retained for as long as the law requires.'
			]
		},
		{
			heading: '10. Warranties and liability',
			body: [
				'The Service is provided "as is", without warranties of any kind, to the fullest extent the law allows.',
				'To the fullest extent permitted by law we are not liable for indirect, incidental, special, or consequential loss, nor for lost profits, revenue, or data. Our total liability arising out of or relating to the Service is limited to the amount you paid us in the [12] months before the event giving rise to the claim.',
				'Nothing here limits liability that cannot be limited by law, including for death or personal injury caused by negligence, or for fraud. If you are a consumer, your statutory rights are unaffected.'
			]
		},
		{
			heading: '11. Changes to these Terms',
			body: [
				"We may update these Terms. For a material change we will give at least [30] days' notice by email or in the Service before it takes effect. Continuing to use the Service after that means you accept the new Terms."
			]
		},
		{
			heading: '12. Governing law',
			body: [
				'These Terms are governed by the law of [jurisdiction], and the courts of [jurisdiction] have exclusive jurisdiction. A consumer resident in the EU keeps the protection of the mandatory law of their country of residence and may bring proceedings there.'
			]
		},
		{
			heading: '13. Contact',
			body: ['[Company Legal Name], [registered address]. Email: [legal@yourdomain].']
		}
	];
</script>

<LegalDocument
	title={m.terms_title()}
	description={m.terms_meta_description()}
	{lastUpdated}
	{sections}
/>
