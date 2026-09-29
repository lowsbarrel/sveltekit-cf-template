import { AppError } from './errors';

export async function verifyTurnstile(
	env: Env,
	token: string | undefined,
	ip?: string
): Promise<void> {
	if (!env.TURNSTILE_SECRET_KEY) return;
	if (!token) throw new AppError('invalid', 'Captcha required');
	const body = new FormData();
	body.append('secret', env.TURNSTILE_SECRET_KEY);
	body.append('response', token);
	if (ip) body.append('remoteip', ip);
	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		body
	});
	const data = (await res.json()) as { success: boolean };
	if (!data.success) throw new AppError('invalid', 'Captcha verification failed');
}
