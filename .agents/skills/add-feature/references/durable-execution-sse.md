# Durable feature with live SSE progress

Blueprint for a feature whose work is long/multi-step/retryable and whose frontend shows
live progress. It uses a **Cloudflare Workflow** for the durable work and an **SSE**
endpoint that streams progress by polling `ctx.db` - no Durable Objects held for state.
Adapt the names (`report`/`job`) to your feature. Example: generating a report.

Architecture: **start action** creates a `job` row and a Workflow instance → **Workflow**
runs idempotent steps, writing progress to the row → **SSE endpoint** streams the row's
status to the browser → **page** renders it via `EventSource`.

## 1. Progress table - `src/lib/server/db/schema.ts`

```ts
export const job = pgTable('job', {
	id: text('id').primaryKey(), // reused as the Workflow instance id
	organizationId: text('organization_id')
		.notNull()
		.references(() => organization.id, { onDelete: 'cascade' }),
	kind: text('kind').notNull(),
	status: text('status').notNull().default('queued'), // queued | running | done | failed
	progress: integer('progress').notNull().default(0), // 0..100
	result: text('result'), // JSON payload or error message once terminal
	...timestamps
});
export type Job = typeof job.$inferSelect;
```

Then `bun run db:generate` + `bun run db:migrate`, and add `"job"` to the truncate list in
`tests/isolate-db.ts`.

## 2. Service - `src/lib/server/jobs/service.ts`

```ts
import { and, eq } from 'drizzle-orm';
import { job } from '../db/schema';
import { AppError } from '../errors';
import { requireMember } from '../orgs/service';
import type { Actor, Ctx } from '../ctx';

export async function createJob(ctx: Ctx, actor: Actor, orgId: string, kind: string) {
	await requireMember(ctx, actor, orgId);
	const [created] = await ctx.db
		.insert(job)
		.values({ id: crypto.randomUUID(), organizationId: orgId, kind })
		.returning();
	if (!created) throw new AppError('internal', 'insert returned no row');
	return created;
}

export async function setJobProgress(
	ctx: Ctx,
	jobId: string,
	patch: { status?: string; progress?: number; result?: string }
) {
	await ctx.db.update(job).set(patch).where(eq(job.id, jobId));
}

export async function getJob(ctx: Ctx, actor: Actor, orgId: string, jobId: string) {
	await requireMember(ctx, actor, orgId);
	const [found] = await ctx.db
		.select()
		.from(job)
		.where(and(eq(job.id, jobId), eq(job.organizationId, orgId)));
	if (!found) throw new AppError('not_found', 'Job not found');
	return found;
}
```

`createJob` and `getJob` authorize with `requireMember`; `getJob` is also org-scoped, so
someone else's job is a 404. `setJobProgress` runs from Workflow steps without an `Actor`
(the job was authorized at creation) and is a plain update, so a step re-running is harmless.

## 3. Workflow - `src/lib/server/workflows/report.ts`

Mirror `example.ts`: steps orchestrate only, each builds a fresh `Ctx`, each is idempotent.

```ts
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { createWorkerCtx } from '../ctx';
import { setJobProgress } from '../jobs/service';

export type ReportPayload = { jobId: string; organizationId: string };

export class ReportWorkflow extends WorkflowEntrypoint<Env, ReportPayload> {
	async run(event: Readonly<WorkflowEvent<ReportPayload>>, step: WorkflowStep) {
		const { jobId } = event.payload;
		try {
			await step.do('start', () =>
				setJobProgress(createWorkerCtx(this.env), jobId, { status: 'running', progress: 0 })
			);

			for (const pct of [25, 50, 75]) {
				await step.do(`work ${pct}`, async () => {
					const ctx = createWorkerCtx(this.env);
					// ...do the pct-th slice against a service (idempotent)...
					await setJobProgress(ctx, jobId, { progress: pct });
				});
			}

			await step.do('finish', () =>
				setJobProgress(createWorkerCtx(this.env), jobId, {
					status: 'done',
					progress: 100,
					result: JSON.stringify({ ok: true })
				})
			);
		} catch (e) {
			// Record terminal failure so the SSE stream ends; don't rethrow.
			await step.do('mark failed', () =>
				setJobProgress(createWorkerCtx(this.env), jobId, { status: 'failed', result: String(e) })
			);
		}
	}
}
```

## 4. Wire it up

`wrangler.jsonc` - add the workflows block, then `bun run cf-typegen`:

```jsonc
"workflows": [{ "binding": "REPORT_WORKFLOW", "name": "report", "class_name": "ReportWorkflow" }]
```

`src/worker.ts` - re-export the class (required, like `ExampleWorkflow`):

```ts
export { ReportWorkflow } from './lib/server/workflows/report';
```

## 5. Start action - in the feature's `+page.server.ts` (or a `+server.ts`)

```ts
const ctx = createCtx(platform);
const created = await createJob(ctx, { id: user.id }, orgId, 'report');
await platform!.env.REPORT_WORKFLOW.create({
	id: created.id, // deterministic (= job id): a double-submit can't double-start
	params: { jobId: created.id, organizationId: orgId }
});
return { jobId: created.id };
```

## 6. SSE endpoint - `src/routes/app/jobs/[id]/stream/+server.ts`

Pushes by polling `ctx.db` (always fresh, never `dbCached`). Bounded per connection;
`EventSource` reconnects for longer jobs.

```ts
import { error } from '@sveltejs/kit';
import { getJob } from '$lib/server/jobs/service';
import { createCtx } from '$lib/server/ctx';
import type { RequestHandler } from './$types';

const POLL_MS = 1000;
const MAX_TICKS = 300; // ~5 min per connection, then the client reconnects

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	const user = locals.user;
	if (!user) error(401, { message: 'Unauthorized', code: 'unauthorized' });
	const orgId = locals.session?.activeOrganizationId;
	if (!orgId) error(404, { message: 'No active organization', code: 'not_found' });

	const ctx = createCtx(platform);
	const actor = { id: user.id };
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			const send = (data: unknown) =>
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
			try {
				for (let tick = 0; tick < MAX_TICKS; tick++) {
					const current = await getJob(ctx, actor, orgId, params.id);
					send({ status: current.status, progress: current.progress, result: current.result });
					if (current.status === 'done' || current.status === 'failed') break;
					await new Promise((r) => setTimeout(r, POLL_MS));
				}
			} catch {
				send({ status: 'failed', progress: 0 });
			} finally {
				controller.close();
				await ctx.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform' // never s-maxage an authenticated route
		}
	});
};
```

## 7. Frontend - the feature's `+page.svelte`

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props(); // data.jobId from the start action/load
	let status = $state('queued');
	let progress = $state(0);

	onMount(() => {
		const es = new EventSource(`/app/jobs/${data.jobId}/stream`);
		es.onmessage = (e) => {
			const job = JSON.parse(e.data);
			status = job.status;
			progress = job.progress;
			if (job.status === 'done' || job.status === 'failed') es.close();
		};
		return () => es.close();
	});
</script>

<div role="status" aria-live="polite" class="space-y-2">
	<progress value={progress} max="100" class="w-full"></progress>
	<p class="text-sm text-muted-foreground">{status} - {progress}%</p>
</div>
```

## Constraints & testing

- **Idempotency** - steps may re-run; `setJobProgress` is a plain update, so re-runs are
  safe. The deterministic instance id (= job id) stops a retried submit double-starting.
- **Freshness** - the SSE loop reads `ctx.db`, never `ctx.dbCached`, or progress would lag.
- **Duration** - each connection is bounded (`MAX_TICKS`); `EventSource` reconnects and the
  loop resumes from the current row, so arbitrarily long jobs still stream to completion.
- **Rate limiting** - one stream is one request, well under the per-IP limit; no change needed.
- **Preview URLs** - Workflows run on Durable-Object-backed infra; Worker Previews
  support them, so PR previews work normally.
- **Tests** - unit-test `createJob`/`getJob`/`setJobProgress` in the `workers` project like
  any service (incl. the "other org gets 404" authorization case). The Workflow itself is
  thin orchestration; keep the logic in services so it's the part under test.
- **Local** - the SSE route works in `bun run dev`; the Workflow binding needs `bun run preview`
  (wrangler dev).
