import type { Session } from '$lib/server/auth';

declare global {
	namespace App {
		interface Error {
			message: string;
			code: string;
			id?: string;
		}
		interface Locals {
			user: Session['user'] | null;
			session: Session['session'] | null;
		}
		interface Platform {
			env: Env;
			cf: CfProperties;
			ctx: ExecutionContext;
		}
	}

	interface Window {
		turnstile?: {
			render: (
				el: HTMLElement,
				opts: {
					sitekey: string;
					callback?: (token: string) => void;
					'expired-callback'?: () => void;
					'error-callback'?: () => void;
				}
			) => string;
			remove: (id: string) => void;
			reset: (id?: string) => void;
		};
	}

	interface Env {
		BETTER_AUTH_SECRET?: string;
		HYPERDRIVE_CACHED?: Hyperdrive;
		EXAMPLE_WORKFLOW?: Workflow<import('$lib/server/workflows/example').ExamplePayload>;
		KV?: KVNamespace;
		R2?: R2Bucket;
		AI?: Ai;
		R2_ACCESS_KEY_ID?: string;
		R2_SECRET_ACCESS_KEY?: string;
		R2_ACCOUNT_ID?: string;
		R2_BUCKET?: string;
		R2_PUBLIC_URL?: string;
		EMAIL?: SendEmail;
		EMAIL_FROM?: string;
		EMAIL_DEBUG?: string;
		GOOGLE_CLIENT_ID?: string;
		GOOGLE_CLIENT_SECRET?: string;
		TURNSTILE_SITE_KEY?: string;
		TURNSTILE_SECRET_KEY?: string;
		CREEM_API_KEY?: string;
		CREEM_WEBHOOK_SECRET?: string;
		CREEM_PRODUCT_PRO?: string;
		CREEM_PRODUCT_TEAM?: string;
		CREEM_PRODUCT_LIFETIME?: string;
		PUBLIC_POSTHOG_KEY?: string;
		PUBLIC_POSTHOG_HOST?: string;
		REALTIME_SECRET?: string;
		PUBLIC_REALTIME_URL?: string;
	}
}

export {};
