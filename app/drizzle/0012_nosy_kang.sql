CREATE TABLE "newsletter_subscriber" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "newsletter_subscriber_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirm_token_hash" text,
	"confirm_token_expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscriber_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "newsletter_subscriber_confirm_token_hash_idx" ON "newsletter_subscriber" USING btree ("confirm_token_hash");