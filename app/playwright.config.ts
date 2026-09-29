import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	use: { baseURL: 'http://localhost:8787' },
	webServer: {
		command: `node scripts/ensure-dev-vars.mjs && bun run db:migrate && bun run preview`,
		url: 'http://localhost:8787/api/health',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
