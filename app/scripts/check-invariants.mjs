import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const violations = [];
const fail = (file, msg) => violations.push({ file, msg });
const rel = (p) => relative(ROOT, p).split(sep).join('/');
const read = (p) => readFileSync(p, 'utf8');

const SKIP_DIRS = new Set(['node_modules', 'paraglide']);
function walk(dir, match, fn) {
	if (!existsSync(dir)) return;
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) {
			if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
			walk(p, match, fn);
		} else if (match.some((suffix) => name.endsWith(suffix))) {
			fn(p, read(p));
		}
	}
}

if (existsSync('src/lib/server/db/schema.ts') && existsSync('tests/isolate-db.ts')) {
	const schema = read('src/lib/server/db/schema.ts');
	const isolate = read('tests/isolate-db.ts');
	for (const m of schema.matchAll(/pgTable\(\s*['"]([a-z_]+)['"]/g)) {
		const table = m[1];
		if (!new RegExp(`["'\`]${table}["'\`]`).test(isolate)) {
			fail(
				'tests/isolate-db.ts',
				`table "${table}" is missing from the TRUNCATE list (add it - it leaks rows between tests)`
			);
		}
	}
}

if (existsSync('bun.lock') && !/^\s*"lockfileVersion": 1,/m.test(read('bun.lock'))) {
	fail(
		'bun.lock',
		'lockfileVersion must stay 1 - Dependabot cannot read 2 yet (docs/deploy.md); set it back to 1'
	);
}

walk('src/routes/app', ['.ts', '.svelte'], (p, c) => {
	if (/s-maxage/.test(c))
		fail(rel(p), 'authenticated route sets s-maxage - never cache behind the auth boundary');
});

const HTML_ALLOW = new Set([
	'src/lib/components/seo/Seo.svelte',
	'src/routes/(marketing)/blog/[slug]/+page.svelte'
]);
walk('src', ['.svelte'], (p, c) => {
	if (/\{@html\b/.test(c) && !HTML_ALLOW.has(rel(p))) {
		fail(
			rel(p),
			'{@html} outside the allowlist - sanitize the input, or add the file to HTML_ALLOW in scripts/check-invariants.mjs'
		);
	}
});

walk('src/lib', ['index.ts'], (p, c) => {
	if (/^\s*export\s+(\*|\{)[^;]*\bfrom\b/m.test(c)) {
		fail(
			rel(p),
			'barrel file - import from the concrete module instead (AGENTS.md: "No barrel files")'
		);
	}
});

walk('src/routes', ['+page.server.ts', '+layout.server.ts', '+page.ts', '+layout.ts'], (p, c) => {
	if (/fetch\(\s*[`'"]\//.test(c)) {
		fail(rel(p), 'a load fetches its own endpoint - import the service directly instead');
	}
});

const DASH = new RegExp('[\\u2013\\u2014]');
const dashCheck = (p, c) => {
	if (rel(p) === 'src/worker-configuration.d.ts') return;
	if (DASH.test(c)) fail(rel(p), 'em/en dash - use a plain ASCII hyphen "-" (AGENTS.md)');
};
walk('src', ['.ts', '.svelte', '.js', '.mjs', '.css', '.md', '.json'], dashCheck);
walk('../docs', ['.md'], dashCheck);
for (const f of ['../AGENTS.md', '../README.md', '../README-IT.md', 'messages/en.json']) {
	if (existsSync(f)) dashCheck(join(ROOT, f), read(f));
}

const PALETTE =
	'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const RAW_PALETTE = new RegExp(
	`\\b(?:bg-white|(?:text|bg|border|ring|fill|stroke|from|via|to|outline|divide|decoration|accent|caret|placeholder)-(?:${PALETTE})-\\d)`
);
walk('src', ['.svelte'], (p, c) => {
	if (/\btext-primary-\d/.test(c))
		fail(
			rel(p),
			'`text-primary-*` - use `text-link`, which stays readable in dark mode (docs/ui.md)'
		);
	if (RAW_PALETTE.test(c))
		fail(
			rel(p),
			'raw palette - use the `primary-*` brand token or a semantic token so dark mode works (docs/ui.md)'
		);
});

const MAX_LINES = 400;
const MAX_COMMENTS = 2;
const DIRECTIVE =
	/^(eslint-|@ts-|svelte-ignore|prettier-ignore|@vite-ignore|<reference\s|@type\s*\{|@satisfies\s*\{)/;
const generated = (f) => f === 'src/worker-configuration.d.ts';

function jsComments(code, offset = 0, kind = ts.ScriptKind.TS) {
	const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, false, kind);
	const found = new Map();
	const visit = (node) => {
		for (const r of [
			...(ts.getLeadingCommentRanges(code, node.pos) ?? []),
			...(ts.getTrailingCommentRanges(code, node.pos) ?? [])
		]) {
			found.set(r.pos, { pos: offset + r.pos, text: code.slice(r.pos, r.end) });
		}
		for (const child of node.getChildren(sf)) visit(child);
	};
	visit(sf);
	return [...found.values()];
}

function cssComments(code, offset = 0) {
	const out = [];
	for (let i = 0; i < code.length; i++) {
		const c = code[i];
		if (c === '"' || c === "'") {
			for (i++; i < code.length && code[i] !== c; i++) if (code[i] === '\\') i++;
		} else if (c === '/' && code[i + 1] === '*') {
			const end = code.indexOf('*/', i + 2);
			const stop = end < 0 ? code.length : end + 2;
			out.push({ pos: offset + i, text: code.slice(i, stop) });
			i = stop - 1;
		}
	}
	return out;
}

function svelteComments(code) {
	const out = [];
	let markup = code;
	for (const m of code.matchAll(/(<script[^>]*>)([\s\S]*?)<\/script>/g)) {
		out.push(...jsComments(m[2], m.index + m[1].length));
		markup = markup.replace(m[0], ' '.repeat(m[0].length));
	}
	for (const m of code.matchAll(/(<style[^>]*>)([\s\S]*?)<\/style>/g)) {
		out.push(...cssComments(m[2], m.index + m[1].length));
		markup = markup.replace(m[0], ' '.repeat(m[0].length));
	}
	for (const m of markup.matchAll(/<!--[\s\S]*?-->/g)) out.push({ pos: m.index, text: m[0] });
	return out;
}

function commentsOf(file, code) {
	if (file.endsWith('.css')) return cssComments(code);
	if (file.endsWith('.svelte')) return svelteComments(code);
	return jsComments(code, 0, file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
}

function checkSource(p, code) {
	const file = rel(p);
	if (generated(file)) return;
	const lines = code.split('\n').length - (code.endsWith('\n') ? 1 : 0);
	if (lines > MAX_LINES) {
		fail(file, `${lines} lines - split it by responsibility (limit ${MAX_LINES})`);
	}
	const lineOf = (pos) => code.slice(0, pos).split('\n').length;
	const comments = commentsOf(file, code)
		.map((c) => ({
			...c,
			line: lineOf(c.pos),
			body: c.text.replace(/^(\/\/+!?|\/\*+!?|<!--)\s*/, '')
		}))
		.filter((c) => !DIRECTIVE.test(c.body))
		.sort((a, b) => a.pos - b.pos);
	const doc = comments.find((c) => /^(\/\/\/|\/\/!|\/\*\*|\/\*!)/.test(c.text));
	const multi = comments.find(
		(c, i) => c.text.includes('\n') || (i > 0 && comments[i - 1].line + 1 === c.line)
	);
	if (doc)
		fail(`${file}:${doc.line}`, 'doc comment - delete it; names and types document the code');
	else if (multi)
		fail(
			`${file}:${multi.line}`,
			'multi-line comment - a comment is one line, if it exists at all'
		);
	if (comments.length > MAX_COMMENTS) {
		fail(
			file,
			`${comments.length} comments (limit ${MAX_COMMENTS}) - keep only the non-obvious constraints`
		);
	}
}

for (const dir of ['src', 'tests', 'e2e', 'smoke'])
	walk(dir, ['.ts', '.js', '.svelte', '.css'], checkSource);
walk('scripts', ['.mjs', '.js'], checkSource);
for (const f of readdirSync('.')) if (/\.config\.(js|ts)$/.test(f)) checkSource(f, read(f));

const hashComments = (p, c) => {
	c.split('\n').forEach((line, i) => {
		if (i === 0 && line.startsWith('#!')) return;
		const bare = line.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '');
		if (/^\s*#|\s#(?!\{)/.test(bare))
			fail(`${rel(p)}:${i + 1}`, 'comment in CI config - CI carries none');
	});
};
walk('../.github', ['.yml', '.yaml', '.sh', 'CODEOWNERS'], hashComments);
walk('../.githooks', ['pre-commit'], hashComments);

if (violations.length) {
	console.error('✖ check:invariants - AGENTS.md invariant violations:\n');
	for (const { file, msg } of violations) console.error(`  ${file}: ${msg}`);
	process.exit(1);
}
console.log('✓ check:invariants - no violations');
