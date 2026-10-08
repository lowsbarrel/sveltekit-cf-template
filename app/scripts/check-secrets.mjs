import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const findings = [];
const flag = (file, msg) => findings.push({ file, msg });

const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const files = execSync('git ls-files', { cwd: root, encoding: 'utf8' })
	.split('\n')
	.filter(Boolean)
	.filter((f) => !/(\.(png|jpe?g|gif|ico|svg|woff2?|lock)$)|(paraglide\/)/.test(f))
	.filter((f) => f !== 'app/scripts/check-secrets.mjs');

const PATTERNS = [
	[/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, 'private key'],
	[/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
	[/GOCSPX-[A-Za-z0-9_-]{20,}/, 'Google OAuth client secret'],
	[/sk_(?:live|test)_[A-Za-z0-9]{16,}/, 'Stripe secret key'],
	[/creem_(?:live|test)_[A-Za-z0-9]{20,}/, 'Creem API key'],
	[/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
	[/gh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
	[/[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@(?!localhost|127\.0\.0\.1)/, 'credential in a URL']
];

for (const f of files) {
	let content;
	try {
		content = readFileSync(join(root, f), 'utf8');
	} catch {
		continue;
	}
	for (const [re, label] of PATTERNS) {
		if (re.test(content)) flag(f, `looks like a ${label}`);
	}
}

if (existsSync('wrangler.jsonc')) {
	const wrangler = readFileSync('wrangler.jsonc', 'utf8');
	const SECRET_VARS = [
		'BETTER_AUTH_SECRET',
		'CREEM_API_KEY',
		'CREEM_WEBHOOK_SECRET',
		'GOOGLE_CLIENT_SECRET',
		'R2_SECRET_ACCESS_KEY'
	];
	for (const v of SECRET_VARS) {
		if (new RegExp(`^\\s*["']${v}["']\\s*:\\s*["'][^"']`, 'm').test(wrangler)) {
			flag(
				'wrangler.jsonc',
				`${v} is a secret - use \`wrangler secret put\`, never wrangler.jsonc`
			);
		}
	}
}

if (findings.length) {
	console.error('✖ check:secrets - potential secrets in tracked files:\n');
	for (const { file, msg } of findings) console.error(`  ${file}: ${msg}`);
	console.error(
		'\nRotate the credential immediately if real. If it is a false positive, refine scripts/check-secrets.mjs.'
	);
	process.exit(1);
}
console.log('✓ check:secrets - no tracked secrets');
