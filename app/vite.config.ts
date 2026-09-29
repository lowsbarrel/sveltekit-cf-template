import { execSync } from 'node:child_process';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import cloudflare from '@sveltejs/adapter-cloudflare';
import node from '@sveltejs/adapter-node';
import { defineConfig } from 'vite';

function resolveVersion(): string {
	const sha =
		process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
	if (sha) return sha.slice(0, 8);
	try {
		return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return `dev-${Date.now()}`;
	}
}

export default defineConfig({
	plugins: [
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['cookie', 'preferredLanguage', 'baseLocale']
		}),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter:
				process.env.ADAPTER === 'node' ? node() : cloudflare({ config: 'wrangler.adapter.jsonc' }),
			// Git SHA per build: clients poll _app/version.json and UpdateToast prompts a reload.
			version: {
				name: resolveVersion(),
				pollInterval: 60_000
			}
		})
	]
});
