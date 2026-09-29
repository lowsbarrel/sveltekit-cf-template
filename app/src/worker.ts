import kit from '#kit-worker';
import { createWorkerCtx } from './lib/server/ctx';
import { purgeExpired } from './lib/server/maintenance/service';

export { ExampleWorkflow } from './lib/server/workflows/example';

export default {
	fetch: kit.fetch,

	async scheduled(controller, env, executionCtx) {
		const ctx = createWorkerCtx(env, executionCtx);
		try {
			const purged = await purgeExpired(ctx);
			console.log({ event: 'cron.purge', cron: controller.cron, ...purged });
		} finally {
			await ctx.close();
		}
	}
} satisfies ExportedHandler<Env>;
