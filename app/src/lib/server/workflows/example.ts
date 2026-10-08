import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { emailForUser } from '../account/service';
import { createWorkerCtx } from '../ctx';
import { purgeExpired } from '../maintenance/service';

export type ExamplePayload = { userId: string };

export class ExampleWorkflow extends WorkflowEntrypoint<Env, ExamplePayload> {
	async run(event: Readonly<WorkflowEvent<ExamplePayload>>, step: WorkflowStep) {
		const email = await step.do('load user', async () => {
			const ctx = createWorkerCtx(this.env);
			try {
				return await emailForUser(ctx, event.payload.userId);
			} finally {
				await ctx.close();
			}
		});
		if (!email) return { skipped: true };

		await step.sleep('let the account settle', '1 day');

		const purged = await step.do('auth-table maintenance', async () => {
			const ctx = createWorkerCtx(this.env);
			try {
				return await purgeExpired(ctx);
			} finally {
				await ctx.close();
			}
		});
		return { email, ...purged };
	}
}
