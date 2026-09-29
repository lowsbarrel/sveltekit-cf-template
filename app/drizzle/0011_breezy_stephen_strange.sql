CREATE TABLE "purchase" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"creem_order_id" text NOT NULL,
	"creem_customer_id" text NOT NULL,
	"creem_product_id" text NOT NULL,
	"status" text NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_creem_order_id_unique" UNIQUE("creem_order_id")
);
--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_organization_id_idx" ON "purchase" USING btree ("organization_id");