import path from 'node:path';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: './wrangler.jsonc' },
			main: path.join(import.meta.dirname, 'tests/worker-stub.ts')
		})
	],
	resolve: {
		alias: { $lib: path.resolve(import.meta.dirname, 'src/lib') }
	},
	test: {
		name: 'workers',
		expect: { requireAssertions: true },
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
		setupFiles: ['./tests/isolate-db.ts'],
		fileParallelism: false,
		deps: {
			optimizer: { ssr: { enabled: true, include: ['drizzle-zod'] } }
		}
	}
});
