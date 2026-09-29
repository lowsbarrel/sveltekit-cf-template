import { AwsClient } from 'aws4fetch';
import postgres from 'postgres';

const { DATABASE_URL, R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } =
	process.env;

if (!DATABASE_URL) fail('DATABASE_URL is required (the freshly restored database).');
if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
	fail('R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY are required.');
}

const aws = new AwsClient({
	accessKeyId: R2_ACCESS_KEY_ID,
	secretAccessKey: R2_SECRET_ACCESS_KEY,
	service: 's3',
	region: 'auto'
});
const base = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;

async function listErasedIds() {
	const ids = [];
	let token;
	do {
		const url = new URL(base + '/');
		url.searchParams.set('list-type', '2');
		url.searchParams.set('prefix', 'erasures/');
		if (token) url.searchParams.set('continuation-token', token);
		const res = await aws.fetch(new Request(url, { method: 'GET' }));
		if (!res.ok) fail(`R2 list failed (${res.status})`);
		const xml = await res.text();
		for (const [, key] of xml.matchAll(/<Key>erasures\/([^<]+)\.json<\/Key>/g)) ids.push(key);
		token = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1];
	} while (token);
	return ids;
}

async function deleteAvatar(id) {
	const res = await aws.fetch(new Request(`${base}/avatars/${id}`, { method: 'DELETE' }));
	if (!res.ok && res.status !== 404) fail(`R2 delete avatars/${id} failed (${res.status})`);
}

const sql = postgres(DATABASE_URL, { max: 2, fetch_types: false });
try {
	const ids = await listErasedIds();
	console.log(`replaying ${ids.length} erasures against the restored database`);
	let deleted = 0;
	for (const id of ids) {
		const rows = await sql`delete from "user" where id = ${id} returning id`;
		if (rows.length) deleted += 1;
		await deleteAvatar(id);
	}
	console.log(
		`done: ${deleted} user rows removed (of ${ids.length} tombstones; the rest were already absent)`
	);
} finally {
	await sql.end();
}

function fail(message) {
	console.error(message);
	process.exit(1);
}
