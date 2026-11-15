CREATE TABLE "seo_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_url" text NOT NULL,
	"days" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_sync_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE INDEX "seo_snapshots_site_days_fetched_at_idx" ON "seo_snapshots" USING btree ("site_url","days","fetched_at");