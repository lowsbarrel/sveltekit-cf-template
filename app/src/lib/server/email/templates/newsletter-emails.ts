import * as m from '$lib/paraglide/messages';
import { baseLocale } from '$lib/paraglide/runtime';
import { SITE } from '$lib/site';
import { buildEmail } from './build';
import type { Locale } from '$lib/locale';
import type { EmailContent } from '../service';

export function newsletterConfirmEmail(to: string, url: string): EmailContent {
	const locale = baseLocale as Locale;
	const o = { locale };
	return buildEmail(to, url, locale, {
		subject: m.email_newsletter_subject({}, o),
		heading: m.email_newsletter_heading({}, o),
		body: m.email_newsletter_body({ app: SITE.name }, o),
		cta: m.email_newsletter_cta({}, o)
	});
}
