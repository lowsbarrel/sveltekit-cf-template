import { AppError } from '../errors';

export type EmailContent = {
	to: string;
	subject: string;
	text: string;
	html?: string;
};

function maskEmail(address: string) {
	const [local, domain] = address.split('@');
	if (!local || !domain) return '***';
	return `${local.slice(0, 1)}***@${domain}`;
}

export async function sendEmail(env: Env, message: EmailContent) {
	if (!env.EMAIL) {
		console.log({
			event: 'email.skipped',
			to: maskEmail(message.to),
			subject: message.subject,
			...(env.EMAIL_DEBUG ? { body: message.text } : {})
		});
		return;
	}
	if (!env.EMAIL_FROM) {
		throw new AppError('internal', 'EMAIL_FROM is not set (vars in wrangler.jsonc)');
	}
	try {
		await env.EMAIL.send({ from: env.EMAIL_FROM, ...message });
	} catch (e) {
		throw new AppError(
			'internal',
			`email send failed: ${e instanceof Error ? e.message : String(e)}`
		);
	}
}
