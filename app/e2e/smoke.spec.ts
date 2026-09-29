import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

const PASSWORD = 'e2e-password-123';

const DB_URL = 'postgresql://postgres:postgres@localhost:5432/app';

async function confirmEmail(email: string) {
	const sql = postgres(DB_URL, { max: 1 });
	try {
		await sql`UPDATE "user" SET email_verified = true WHERE email = ${email}`;
	} finally {
		await sql.end();
	}
}

async function markOnboarded(email: string) {
	const sql = postgres(DB_URL, { max: 1 });
	try {
		await sql`UPDATE "user" SET onboarded_at = now() WHERE email = ${email}`;
	} finally {
		await sql.end();
	}
}

async function pokeActiveOrg(email: string, orgId: string) {
	const sql = postgres(DB_URL, { max: 1 });
	try {
		await sql`UPDATE "session" SET active_organization_id = ${orgId} WHERE user_id = (SELECT id FROM "user" WHERE email = ${email})`;
	} finally {
		await sql.end();
	}
}

async function signUp(page: Page, email: string) {
	await page.goto('/signup');
	await page.getByLabel('Name').fill('E2E');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign up', exact: true }).click();
	await expect(page.getByText(/confirmation link/i)).toBeVisible();
}

async function signIn(page: Page, email: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page).toHaveURL(/\/app$/);
}

test('health endpoint responds with security headers', async ({ request }) => {
	const res = await request.get('/api/health');
	expect(res.ok()).toBeTruthy();
	expect(await res.json()).toMatchObject({ status: 'ok' });
	const headers = res.headers();
	expect(headers['x-content-type-options']).toBe('nosniff');
	expect(headers['x-frame-options']).toBe('DENY');
	expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
	expect(headers['permissions-policy']).toContain('camera=()');
	expect(headers['strict-transport-security']).toContain('max-age=');
});

test('the landing page is public and indexable', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
});

test('the app is behind the auth boundary', async ({ page }) => {
	await page.goto('/app');
	await expect(page).toHaveURL(/\/login$/);
});

test('public pages render', async ({ page }) => {
	for (const path of ['/pricing', '/blog', '/terms', '/privacy', '/cookies']) {
		await page.goto(path);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	}
});

test('a blog post is prerendered from Markdown', async ({ page }) => {
	await page.goto('/blog');
	await page
		.getByRole('link', { name: /welcome to sveltekit-cf-template/i })
		.first()
		.click();
	await expect(page).toHaveURL(/\/blog\/welcome-to-sveltekit-cf-template$/);
	await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
});

test('the billing webhook rejects an unsigned request', async ({ request }) => {
	const res = await request.post('/api/webhooks/creem', {
		data: { id: 'evt_forged', eventType: 'subscription.paid', created_at: 1, object: {} }
	});
	expect(res.status()).toBe(401);
});

test('robots.txt disallows the app and points at the sitemap', async ({ request }) => {
	const res = await request.get('/robots.txt');
	expect(res.ok()).toBeTruthy();
	const body = await res.text();
	expect(body).toContain('Disallow: /app');
	expect(body).toContain('Sitemap: ');
});

test('sitemap.xml lists the public pages only', async ({ request }) => {
	const res = await request.get('/sitemap.xml');
	expect(res.ok()).toBeTruthy();
	const body = await res.text();
	expect(body).toContain('<loc>');
	expect(body).toContain('/terms');
	expect(body).not.toContain('/app');
});

test('a password signup is unusable until the email is confirmed', async ({ page }) => {
	const email = `e2e-unverified-${Date.now()}@example.com`;

	await page.goto('/signup');
	await page.getByLabel('Name').fill('E2E');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign up', exact: true }).click();

	await expect(page.getByText(/confirmation link/i)).toBeVisible();
	await expect(page).toHaveURL(/\/signup$/);

	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page).toHaveURL(/\/login$/);

	await page.goto('/app');
	await expect(page).toHaveURL(/\/login$/);
});

test('sign up, onboard, create a todo, sign out', async ({ page }) => {
	const email = `e2e-${Date.now()}@example.com`;
	await signUp(page, email);

	await confirmEmail(email);

	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page).toHaveURL(/\/app\/onboarding$/);

	await expect(page.getByRole('heading', { name: /name your workspace/i })).toBeVisible();
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await expect(page.getByRole('heading', { name: /set up your profile/i })).toBeVisible();
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await expect(page.getByRole('heading', { name: /invite your team/i })).toBeVisible();
	await page.getByRole('button', { name: /skip for now/i }).click();
	await expect(page.getByRole('heading', { name: /choose a plan/i })).toBeVisible();
	await page.getByRole('button', { name: /go to dashboard/i }).click();
	await expect(page).toHaveURL(/\/app$/);

	await page.goto('/app/onboarding');
	await expect(page).toHaveURL(/\/app$/);

	await expect(page.getByRole('heading', { name: 'Todos' })).toBeVisible();
	const title = `e2e ${Date.now()}`;
	await page.getByLabel('Title').fill(title);
	await page.getByRole('button', { name: 'Add' }).click();
	await expect(page.getByRole('listitem').filter({ hasText: title })).toBeVisible();

	await page.getByRole('button', { name: 'Mark as done' }).click();
	await expect(page.getByRole('button', { name: 'Mark as not done' })).toBeVisible();

	await page.getByRole('button', { name: 'Account menu' }).click();
	await expect(page.getByText(email)).toBeVisible();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/$/);
});

test('billing is org-scoped and the owner can reach it', async ({ page }) => {
	const email = `e2e-billing-${Date.now()}@example.com`;
	await signUp(page, email);
	await confirmEmail(email);
	await markOnboarded(email);
	await signIn(page, email);

	await page.goto('/app/billing');
	await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
	await expect(page.getByText(/on the free plan/i)).toBeVisible();

	await pokeActiveOrg(email, 'org-that-no-longer-has-them');
	await page.goto('/app/billing');
	await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();

	await page.goto('/app/team');
	await page.getByLabel(/email address/i).fill('teammate@example.com');
	await page.getByRole('button', { name: /send invite/i }).click();
	await expect(page.getByText(/plan allows|upgrade to invite/i)).toBeVisible();
});

test('a reset link with no token is rejected', async ({ page }) => {
	await page.goto('/reset-password');
	await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
});

test('magic link never reveals whether an address has an account', async ({ page }) => {
	await page.goto('/magic-link');
	await page.getByLabel('Email').fill(`nobody-${Date.now()}@example.com`);
	await page.getByRole('button', { name: 'Send me a link' }).click();

	await expect(page.getByText(/a sign-in link is on its way/i)).toBeVisible();
});

test('the Google button is hidden when OAuth is not configured', async ({ page }) => {
	await page.goto('/login');
	await expect(page.getByRole('button', { name: /continue with google/i })).toBeHidden();
	await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
