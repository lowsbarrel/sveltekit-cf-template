import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';

export type Ctx = {
	db: ReturnType<typeof createDb>;
	dbCached: ReturnType<typeof createDb>;
	waitUntil: (promise: Promise<unknown>) => void;
	close: () => Promise<void>;
};

export type Actor = { id: string };

function createClient(connectionString: string) {
	const client = postgres(connectionString, {
		max: 5,
		fetch_types: false
	});
	return drizzle(client, { schema });
}

export function createDb(env: Env) {
	return createClient(env.HYPERDRIVE.connectionString);
}

export function createCtx(platform: App.Platform | undefined): Ctx {
	if (!platform?.env) {
		throw new Error('Cloudflare platform unavailable - run through vite dev or wrangler dev');
	}
	return createWorkerCtx(platform.env, platform.ctx);
}

export function createWorkerCtx(env: Env, executionCtx?: App.Platform['ctx']): Ctx {
	const clients: ReturnType<typeof postgres>[] = [];
	const make = (connectionString: string) => {
		const client = postgres(connectionString, { max: 5, fetch_types: false });
		clients.push(client);
		return drizzle(client, { schema });
	};
	const db = make(env.HYPERDRIVE.connectionString);
	return {
		db,
		dbCached: env.HYPERDRIVE_CACHED ? make(env.HYPERDRIVE_CACHED.connectionString) : db,
		waitUntil: executionCtx
			? (promise) => executionCtx.waitUntil(promise)
			: (promise) => void promise.catch((e) => console.error({ event: 'waituntil_failed' }, e)),
		close: async () => {
			await Promise.allSettled(clients.map((client) => client.end()));
		}
	};
}
