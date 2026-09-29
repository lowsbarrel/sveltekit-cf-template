import { expect, test } from '@playwright/test';

test('health endpoint is live', async ({ request }) => {
	const res = await request.get('/api/health');
	expect(res.ok()).toBeTruthy();
	expect(await res.json()).toMatchObject({ status: 'ok' });
});

test('landing page responds', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('pricing page renders', async ({ page }) => {
	await page.goto('/pricing');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('login page renders without submitting', async ({ page }) => {
	await page.goto('/login');
	await expect(page.getByLabel('Email')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
