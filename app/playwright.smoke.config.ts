import { defineConfig, devices } from '@playwright/test';

const BASE = process.env.TEST_PAGE_URL ?? process.env.SMOKE_URL;
if (!BASE) throw new Error('set TEST_PAGE_URL (or SMOKE_URL) to the deployed origin');

export default defineConfig({
	testDir: 'smoke',
	projects: [{ name: 'smoke', use: { ...devices['Desktop Chrome'] } }],
	use: { baseURL: BASE },
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0
});
