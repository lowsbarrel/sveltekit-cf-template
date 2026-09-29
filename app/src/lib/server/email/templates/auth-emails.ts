import * as m from '$lib/paraglide/messages';
import { SITE } from '$lib/site';
import { buildEmail } from './build';
import type { Locale } from '$lib/locale';
import type { EmailContent } from '../service';

export function resetPasswordEmail(to: string, url: string, locale: Locale): EmailContent {
	const o = { locale };
	return buildEmail(to, url, locale, {
		subject: m.email_reset_subject({}, o),
		heading: m.email_reset_heading({}, o),
		body: m.email_reset_body({}, o),
		cta: m.email_reset_cta({}, o)
	});
}

export function magicLinkEmail(to: string, url: string, locale: Locale): EmailContent {
	const o = { locale };
	return buildEmail(to, url, locale, {
		subject: m.email_magic_subject({}, o),
		heading: m.email_magic_heading({}, o),
		body: m.email_magic_body({}, o),
		cta: m.email_magic_cta({}, o)
	});
}

export function verifyEmail(to: string, url: string, locale: Locale): EmailContent {
	const o = { locale };
	return buildEmail(to, url, locale, {
		subject: m.email_verify_subject({}, o),
		heading: m.email_verify_heading({}, o),
		body: m.email_verify_body({}, o),
		cta: m.email_verify_cta({}, o)
	});
}

export function invitationEmail(
	to: string,
	org: string,
	inviter: string,
	url: string,
	locale: Locale
): EmailContent {
	const o = { locale };
	return buildEmail(to, url, locale, {
		subject: m.email_invite_subject({ org }, o),
		heading: m.email_invite_heading({ org }, o),
		body: m.email_invite_body({ inviter, org }, o),
		cta: m.email_invite_cta({}, o)
	});
}

export function deleteAccountEmail(to: string, url: string, locale: Locale): EmailContent {
	const o = { locale };
	return buildEmail(to, url, locale, {
		subject: m.email_delete_subject({}, o),
		heading: m.email_delete_heading({}, o),
		body: m.email_delete_body({}, o),
		cta: m.email_delete_cta({}, o)
	});
}

export function changeEmailEmail(
	to: string,
	newEmail: string,
	url: string,
	locale: Locale
): EmailContent {
	const o = { locale };
	return buildEmail(to, url, locale, {
		subject: m.email_change_subject({}, o),
		heading: m.email_change_heading({}, o),
		body: m.email_change_body({ email: newEmail }, o),
		cta: m.email_change_cta({}, o)
	});
}

export function welcomeEmail(to: string, name: string, url: string, locale: Locale): EmailContent {
	const o = { locale };
	return buildEmail(to, url, locale, {
		subject: m.email_welcome_subject({ app: SITE.name }, o),
		heading: m.email_welcome_heading({ app: SITE.name }, o),
		body: m.email_welcome_body({ name }, o),
		cta: m.email_welcome_cta({}, o)
	});
}
