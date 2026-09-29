import * as m from '$lib/paraglide/messages';
import { SITE } from '$lib/site';
import { emailLayout } from './layout';
import type { Locale } from '$lib/locale';
import type { EmailContent } from '../service';

function build(
	to: string,
	url: string,
	locale: Locale,
	parts: { subject: string; heading: string; body: string; cta: string }
): EmailContent {
	const footer = m.email_footer({ name: SITE.name }, { locale });
	return {
		to,
		subject: parts.subject,
		text: `${parts.heading}\n\n${parts.body}\n\n${url}\n\n${footer}`,
		html: emailLayout({
			heading: parts.heading,
			body: parts.body,
			buttonUrl: url,
			buttonLabel: parts.cta,
			footer
		})
	};
}

export function billingActiveEmail(
	to: string,
	plan: string,
	url: string,
	locale: Locale
): EmailContent {
	const o = { locale };
	return build(to, url, locale, {
		subject: m.email_billing_active_subject({ plan }, o),
		heading: m.email_billing_active_heading({ plan }, o),
		body: m.email_billing_active_body({ plan }, o),
		cta: m.email_billing_active_cta({}, o)
	});
}

export function billingRenewedEmail(
	to: string,
	plan: string,
	url: string,
	locale: Locale
): EmailContent {
	const o = { locale };
	return build(to, url, locale, {
		subject: m.email_billing_renewed_subject({ plan }, o),
		heading: m.email_billing_renewed_heading({ plan }, o),
		body: m.email_billing_renewed_body({ plan }, o),
		cta: m.email_billing_renewed_cta({}, o)
	});
}

export function billingCanceledEmail(
	to: string,
	plan: string,
	url: string,
	locale: Locale
): EmailContent {
	const o = { locale };
	return build(to, url, locale, {
		subject: m.email_billing_canceled_subject({}, o),
		heading: m.email_billing_canceled_heading({}, o),
		body: m.email_billing_canceled_body({ plan }, o),
		cta: m.email_billing_canceled_cta({}, o)
	});
}

export function billingPaymentFailedEmail(
	to: string,
	plan: string,
	url: string,
	locale: Locale
): EmailContent {
	const o = { locale };
	return build(to, url, locale, {
		subject: m.email_billing_payment_failed_subject({}, o),
		heading: m.email_billing_payment_failed_heading({}, o),
		body: m.email_billing_payment_failed_body({ plan }, o),
		cta: m.email_billing_payment_failed_cta({}, o)
	});
}

export function billingLifetimeEmail(
	to: string,
	plan: string,
	url: string,
	locale: Locale
): EmailContent {
	const o = { locale };
	return build(to, url, locale, {
		subject: m.email_billing_lifetime_subject({ plan }, o),
		heading: m.email_billing_lifetime_heading({ plan }, o),
		body: m.email_billing_lifetime_body({ plan }, o),
		cta: m.email_billing_lifetime_cta({}, o)
	});
}
