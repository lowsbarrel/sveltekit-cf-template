import { describe, expect, it } from 'vitest';
import { baseLocale } from '$lib/paraglide/runtime';
import { invitationEmail } from './auth-emails';
import { emailLayout } from './layout';
import type { Locale } from '$lib/locale';

const locale = baseLocale as Locale;

describe('emailLayout', () => {
	it('escapes every interpolated value', () => {
		const html = emailLayout({
			heading: '<a href="x">',
			body: '<script>alert(1)</script>',
			buttonUrl: 'https://example.com/?a=1&b=2',
			buttonLabel: 'Click <b>here</b>',
			footer: "it's fine"
		});

		expect(html).toContain('&lt;a href=&quot;x&quot;&gt;');
		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(html).toContain('https://example.com/?a=1&amp;b=2');
		expect(html).toContain('Click &lt;b&gt;here&lt;/b&gt;');
		expect(html).toContain('it&#39;s fine');
	});
});

describe('invitationEmail', () => {
	it('renders a malicious org name as text, not as an anchor', () => {
		const content = invitationEmail(
			'invitee@example.com',
			'<a href="x">',
			'Inviter',
			'https://example.com/invite?token=abc',
			locale
		);

		expect(content.html).toContain('&lt;a href=&quot;x&quot;&gt;');
		expect(content.html).not.toContain('<a href="x"');
	});
});
