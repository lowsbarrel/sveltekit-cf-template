# Cloudflare platform

Every binding beyond the database: storage, async work, AI, observability - and what to do when a feature needs a stateful Durable Object.

## KV & R2 (opt-in)

Commented blocks in `wrangler.jsonc`, same idiom as the other seams: **KV** for small, hot key-value state (feature flags, cached lookups - eventually consistent, not a database) and **R2** for object storage (uploads, generated files - S3-compatible, zero egress). Both are fully emulated in local dev and tests, so the flow is: uncomment the block, create the real resource (`wrangler kv namespace create KV` / `wrangler r2 bucket create <name>`), `bun run cf-typegen` - and `env.KV` / `env.R2` are typed everywhere. If a service comes to depend on one, thread it through `Ctx` rather than reaching for `env` directly.

**Uploads/downloads without proxying bytes**: `$lib/server/storage/service.ts` issues presigned R2 URLs (via `aws4fetch` against R2's S3-compatible API - the binding itself can't presign), so the browser PUTs/GETs straight to R2. Needs the `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` secrets plus `R2_ACCOUNT_ID`/`R2_BUCKET` vars; keys are actor-scoped by the calling service (`${actor.id}/...`), which is the authorization.

**Limiting size and type**: the caller passes a policy, not the storage layer. `assertUploadWithin({ contentType, size }, { allowedTypes, maxBytes })` throws `invalid` before a URL is issued, and `presignedUploadUrl(env, key, { contentType, contentLength })` signs both the content type and the exact byte length into the URL, so R2 rejects a mismatched `Content-Type` or a body of a different length at the edge (`403/SignatureDoesNotMatch`). Browsers compute `Content-Length` from the body and cannot override it, so signing the declared size pins the upload to the validated length. The authoritative gate is still `uploadedObjectMeta(env, key)` (a signed `HEAD`) after the upload - re-check `size`/`contentType` against the same policy and `deleteObject(env, key)` on a violation. The avatar flow is the reference: `avatarUploadTarget` validates and signs; the client PUTs; `confirmAvatarUpload` HEADs the stored object, sets `user.image` only when it passes, and deletes it otherwise (so the client never chooses the stored URL). Source the numbers where they belong - a per-plan cap lives in `$lib/plans.ts`, a fixed one like the avatar's in `$lib/avatar.ts`.

## Async work, schedules & realtime

Every kind of non-request work has a designated seam:

- **Post-response work** - `ctx.waitUntil(promise)` on the `Ctx` every service receives: runs after the response is sent, never awaited inline.
- **Cron** - `triggers.crons` in `wrangler.jsonc` → the `scheduled` handler in `src/worker.ts`. The SvelteKit adapter only emits a `fetch` handler, so `src/worker.ts` is a custom entry that re-exports it and hosts everything non-HTTP. A real job ships enabled: daily purge of expired sessions and verification tokens (`$lib/server/maintenance`, tested in the `workers` project). Trigger it locally: `bun run preview`, then `curl 'http://localhost:8787/__scheduled?cron=0+3+*+*+*'`.
- **Queues** - uncomment the `queues` block in `wrangler.jsonc`, run `bun run cf-typegen`, and add a `queue` handler next to `scheduled` in `src/worker.ts`. Same rule as routes: the handler builds a `Ctx` via `createWorkerCtx` and calls a service.

  ```ts
  async queue(batch, env, executionCtx) {
  	const ctx = createWorkerCtx(env, executionCtx);
  	try {
  		for (const message of batch.messages) {
  			await handleJob(ctx, message.body);
  			message.ack();
  		}
  	} finally {
  		await ctx.close();
  	}
  }
  ```

- **Durable multi-step workflows** - [Cloudflare Workflows](https://developers.cloudflare.com/workflows/): checkpointed steps, automatic retries, sleeps from minutes to weeks. A typechecked example ships in `$lib/server/workflows/example.ts` (load user → sleep a day → idempotent maintenance), exported from `src/worker.ts`; enable it by uncommenting the `workflows` block in `wrangler.jsonc` + `bun run cf-typegen`, then `env.EXAMPLE_WORKFLOW.create({ params })`. Steps are orchestration only - each builds a fresh `Ctx`, closes it in a `finally`, and calls a service (the `worker.ts` pattern); a step may run more than once, so it must be idempotent. To run one **on a schedule**, start it from the `scheduled` handler with a deterministic instance id derived from the scheduled date (`` await env.EXAMPLE_WORKFLOW.create({ id: `nightly-${new Date(controller.scheduledTime).toISOString().slice(0, 10)}`, params }) ``) - duplicate ids are rejected, so cron retries can't double-start an instance. One note: Workflows run on Durable-Object-backed infrastructure; Worker Previews support them, so PR previews work normally ([deploy.md](deploy.md)).
- **AI chat / streaming (SSE)** - needs nothing extra: a SvelteKit endpoint can return a streaming `Response` on Workers, and the AI SDK's `toUIMessageStreamResponse()` (below) is exactly that.
- **WebSockets** - anything stateful (rooms, presence) needs Durable Objects. They're allowed and previewable now (Worker Previews), but a DO-class change can't ship via `deploy:canary` and can't be rolled back across, so to keep this app on the full versioned/rollback model the recommendation is still a sidecar Worker (below). AI chat does not need WebSockets - use SSE streaming.

## AI (opt-in)

`ai` (Vercel AI SDK) and `workers-ai-provider` are installed but no endpoint ships: Workers AI needs Cloudflare auth even in local dev, and everything in this template runs offline. To enable: uncomment the `ai` binding in `wrangler.jsonc`, run `bun run cf-typegen`, and add e.g.:

```ts
// src/routes/api/chat/+server.ts
import { error } from '@sveltejs/kit';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	const ai = platform?.env.AI;
	if (!ai) error(500, 'AI binding missing');
	const { messages }: { messages: UIMessage[] } = await request.json();
	const workersai = createWorkersAI({ binding: ai });
	const result = streamText({
		model: workersai('@cf/meta/llama-3.3-70b-instruct-fp8-fast'),
		messages: await convertToModelMessages(messages)
	});
	return result.toUIMessageStreamResponse();
};
```

Before shipping an AI feature, read [ai-compliance.md](ai-compliance.md): shipping AI brings transparency duties (EU AI Act, US state laws). The template's `AiDisclosure` component and a checklist are there.

## Adding a second Worker (Durable Objects, stateful WebSockets)

The proven shape when a feature needs a Durable Object but you want this app to stay on the full canary + rollback release model - isolate the stateful part there:

- `<name>/wrangler.jsonc` + `<name>/src/` in this repo, sharing the root `package.json` (one dependency tree). Reuse the same Hyperdrive id if it needs the database.
- Typecheck: append `&& tsc -p <name>` to the `check` script; add its config to `cf-typegen` (`wrangler types -c <name>/wrangler.jsonc <name>/worker-configuration.d.ts`).
- Auth across workers: this app authorizes in its services, then mints a short-lived HMAC token; the second worker verifies the signature only. No sessions, no DB over there. The HMAC helpers live in `$lib/server/realtime/service.ts` today; move them to a pure WebCrypto module (no SvelteKit, env or DB imports, e.g. `$lib/utils/`) that both workers import - see [realtime.md](realtime.md).
- Dev & E2E: a `dev:<name>` script (`wrangler dev -c <name>/wrangler.jsonc --port 8788`) and a second entry in Playwright's `webServer` array. Expose its URL to browsers via a `vars` entry, read from `platform.env` at request time - never build-time.
- Deploy: one more `wrangler deploy -c <name>/wrangler.jsonc` step in the CI deploy job.
- Known limits: the PR preview job only previews _this_ Worker (previews will talk to the deployed second worker), and the bundle-size guardrail only measures this one - extend both when the second worker grows real logic.

## Observability

On by default in `wrangler.jsonc`: [Workers Logs](https://developers.cloudflare.com/workers/observability/) (`observability.enabled`) captures every `console.*` call - log **structured objects** (`console.log({ ... })`), the dashboard indexes JSON fields - and `upload_source_maps` gives readable stack traces. The `handleError` hook tags every unexpected 500 with an error id you can search for.

Level up when you need it:

- **Tracing** - Cloudflare's [automatic tracing](https://developers.cloudflare.com/workers/observability/traces/) instruments every I/O operation (Hyperdrive, KV, R2, fetch) with zero code changes; it follows OpenTelemetry standards and [exports OTLP](https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/) to Honeycomb, Grafana, Axiom, **or Pydantic Logfire** (any OTLP endpoint). Enable per the traces doc - it's billed separately.
- **App-level Logfire** - coming from Python? [`@pydantic/logfire-cf-workers`](https://github.com/pydantic/logfire-js) is the official Workers package: wrap the handlers in `src/worker.ts`, send spans/logs to the same Logfire project as your Python services.
- **Sentry** - [`@sentry/sveltekit` supports Cloudflare](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/sveltekit/) via `initCloudflareSentryHandle` in `hooks.server.ts` (needs a DSN; client + server error capture and tracing).

## Debugging

- `bun run dev`: SvelteKit's SSR runs in **Node** with Miniflare-backed bindings - `@cloudflare/vite-plugin` doesn't support SvelteKit yet, so full workerd parity in dev isn't available. The "Dev: full stack" launch config gives working breakpoints in `load`/endpoints plus attached Chrome. The parity gap is covered by the `workers` test project, `bun run preview`, and E2E.
- `bun run preview`: code runs in workerd; use "Attach to workerd" (inspector on :9229).
- Tests: open the spec and start "Debug current test file" (server specs, in workerd) or "Debug current component test" (`*.svelte.spec.ts`, in Chromium). Both run Vitest on that file with the inspector on :9229 and attach to it.
