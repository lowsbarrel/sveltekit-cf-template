import { appendFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs';

const EXAMPLE = '.dev.vars.example';
const TARGET = '.dev.vars';

const keyOf = (line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1] ?? null;

if (!existsSync(TARGET)) {
	copyFileSync(EXAMPLE, TARGET);
	console.log('created .dev.vars from .dev.vars.example');
} else if (existsSync(EXAMPLE)) {
	const have = new Set(readFileSync(TARGET, 'utf8').split('\n').map(keyOf).filter(Boolean));
	const missing = readFileSync(EXAMPLE, 'utf8')
		.split('\n')
		.filter((line) => {
			const k = keyOf(line);
			return k && !have.has(k);
		});
	if (missing.length) {
		appendFileSync(TARGET, '\n' + missing.join('\n') + '\n');
		console.log(`backfilled into .dev.vars: ${missing.map(keyOf).join(', ')}`);
	}
}
