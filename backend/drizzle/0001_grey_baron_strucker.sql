CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"path" text NOT NULL,
	"product_id" integer,
	"category_id" integer,
	"visitor_id" text NOT NULL,
	"session_id" text,
	"referrer_host" text,
	"device" text,
	"value" double precision,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_type_created_at_idx" ON "analytics_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_product_id_idx" ON "analytics_events" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "analytics_events_path_idx" ON "analytics_events" USING btree ("path");