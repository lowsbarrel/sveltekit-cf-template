import * as m from '$lib/paraglide/messages';
import { SITE } from '$lib/site';
import { emailLayout } from './layout';
import type { Locale } from '$lib/locale';
import type { EmailContent } from '../service';

export function buildEmail(
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
