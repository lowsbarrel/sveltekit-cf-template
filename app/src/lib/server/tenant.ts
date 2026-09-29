import { sql } from 'drizzle-orm';
import type { Ctx } from './ctx';

export type TenantTx = Parameters<Parameters<Ctx['db']['transaction']>[0]>[0];

export function withTenant<T>(
	ctx: Ctx,
	orgId: string,
	fn: (tx: TenantTx) => Promise<T>
): Promise<T> {
	return ctx.db.transaction(async (tx) => {
		await tx.execute(sql`select set_config('app.current_org_id', ${orgId}, true)`);
		return fn(tx);
	});
}
