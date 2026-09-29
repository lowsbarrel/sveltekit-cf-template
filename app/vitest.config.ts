import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: ['./vitest.workers.config.ts', './vitest.browser.config.ts'],
		onUnhandledError(error) {
			if (error.message?.includes('Stream was cancelled')) return false;
		}
	}
});
