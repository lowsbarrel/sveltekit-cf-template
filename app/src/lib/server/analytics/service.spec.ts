import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createWorkerCtx } from '../ctx';
import { captureServerIfConsented } from './service';

const serverEvent = { event: 'checkout_started', distinctId: 'user-1' };
const analyticsEnv = { ...env, PUBLIC_POSTHOG_KEY: undefined } as Env;

function spyCtx() {
	const pending: Promise<unknown>[] = [];
	return {
		pending,
		ctx: { ...createWorkerCtx(env), waitUntil: (p: Promise<unknown>) => void pending.push(p) }
	};
}

describe('captureServerIfConsented', () => {
	it('schedules no capture when consent was not granted', () => {
		const { ctx, pending } = spyCtx();
		captureServerIfConsented(ctx, analyticsEnv, false, serverEvent);
		expect(pending).toHaveLength(0);
	});

	it('schedules the capture when consent was granted', () => {
		const { ctx, pending } = spyCtx();
		captureServerIfConsented(ctx, analyticsEnv, true, serverEvent);
		expect(pending).toHaveLength(1);
	});
});
