import { SITE } from '$lib/site';

export function emailLayout(opts: {
	heading: string;
	body: string;
	buttonUrl: string;
	buttonLabel: string;
	footer: string;
}): string {
	const { heading, body, buttonUrl, buttonLabel, footer } = opts;
	return `<!doctype html>
<html>
	<body style="margin:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
			<tr><td align="center">
				<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;background:#ffffff;border-radius:8px;">
					<tr><td style="padding:20px 32px;border-bottom:1px solid #e5e7eb;font-weight:600;font-size:18px;color:#111827;">${SITE.name}</td></tr>
					<tr><td style="padding:32px;color:#374151;font-size:15px;line-height:1.6;">
						<h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${heading}</h1>
						<p style="margin:0 0 24px;">${body}</p>
						<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background:#2563eb;">
							<a href="${buttonUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;">${buttonLabel}</a>
						</td></tr></table>
						<p style="margin:24px 0 0;font-size:13px;color:#6b7280;word-break:break-all;">${buttonUrl}</p>
					</td></tr>
					<tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">${footer}</td></tr>
				</table>
			</td></tr>
		</table>
	</body>
</html>`;
}
