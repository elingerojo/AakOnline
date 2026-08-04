CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"product_image" text NOT NULL,
	"bg_image" text NOT NULL,
	"models" integer DEFAULT 0,
	"variants" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"category_id" integer NOT NULL,
	"name" text,
	"slug" text NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"image_list" jsonb DEFAULT '[]'::jsonb,
	"variant_selections" jsonb,
	"original_price" double precision DEFAULT 0,
	"current_price" double precision DEFAULT 0,
	"shipping_components" jsonb,
	"featured_section" text,
	"featured_image" text DEFAULT '',
	"tags" jsonb DEFAULT '[]'::jsonb,
	"score" double precision DEFAULT 0,
	"ratings" integer DEFAULT 0,
	"short_description" text DEFAULT '',
	"long_description" text DEFAULT '',
	"marketing_phrase" text DEFAULT '',
	"status" text DEFAULT 'pendiente',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shipping_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"category_name" text NOT NULL,
	"tiers" jsonb NOT NULL,
	"extra_unit_factor" double precision DEFAULT 0.5,
	CONSTRAINT "shipping_config_category_id_unique" UNIQUE("category_id")
);
