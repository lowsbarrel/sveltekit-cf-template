import { execFileSync } from 'node:child_process';

const TEMPLATE_REMOTE = 'template';
const TEMPLATE_REMOTE_URL = 'git@github.com:lowsbarrel/sveltekit-cf-template.git';
const TEMPLATE_BRANCH = 'template/main';

const INFRA = [
	'docs/',
	'AGENTS.md',
	'.github/',
	'.githooks/',
	'.agents/skills/',
	'app/scripts/',
	'app/src/lib/server/ctx.ts',
	'app/src/lib/server/errors.ts',
	'app/src/lib/server/auth.ts',
	'app/src/lib/server/tenant.ts',
	'eslint.config',
	'prettier',
	'tsconfig',
	'vite.config',
	'svelte.config'
];

const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();

const tryGit = (args) => {
	try {
		return { ok: true, out: git(args) };
	} catch (e) {
		return { ok: false, out: (e.stdout ?? '') + (e.stderr ?? '') };
	}
};

if (git(['status', '--porcelain'])) {
	fail('working tree is not clean - stash or commit before upgrading.');
}

const remotes = git(['remote']).split('\n').filter(Boolean);
if (!remotes.includes(TEMPLATE_REMOTE)) {
	git(['remote', 'add', TEMPLATE_REMOTE, TEMPLATE_REMOTE_URL]);
	console.log(`added remote '${TEMPLATE_REMOTE}' -> ${TEMPLATE_REMOTE_URL}`);
}

console.log(`fetching ${TEMPLATE_REMOTE}...`);
git(['fetch', TEMPLATE_REMOTE]);

const branch = `upgrade/${new Date().toISOString().slice(0, 10)}`;
const branches = git(['branch', '--list', branch]);
git(branches ? ['switch', branch] : ['switch', '-c', branch]);
console.log(`on branch ${branch}`);

const merge = tryGit(['merge', '--no-commit', '--no-ff', TEMPLATE_BRANCH]);
if (merge.ok) {
	if (merge.out.includes('Already up to date')) {
		console.log('already up to date - nothing to merge.');
	} else {
		console.log('merge applied cleanly and left uncommitted.');
		console.log('review the diff, run the gate, then commit and open a PR.');
	}
	process.exit(0);
}

const conflicts = git(['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean);
const isInfra = (f) => INFRA.some((p) => (p.endsWith('/') ? f.startsWith(p) : f.includes(p)));
const infra = conflicts.filter(isInfra);
const business = conflicts.filter((f) => !isInfra(f));

console.log(`\nmerge stopped with ${conflicts.length} conflicted file(s):\n`);
if (infra.length) {
	console.log('TEMPLATE INFRA (take theirs):');
	for (const f of infra) console.log(`  ${f}`);
}
if (business.length) {
	console.log('PROJECT / IDENTITY (keep ours, review by hand):');
	for (const f of business) console.log(`  ${f}`);
}
console.log('\nresolve per docs/upgrading.md, then run the gate. the merge is left uncommitted.');
process.exit(1);

function fail(message) {
	console.error(message);
	process.exit(1);
}
