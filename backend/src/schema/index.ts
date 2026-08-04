import { pgTable, serial, integer, text, doublePrecision, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sku: text('sku').notNull(),
  categoryId: integer('category_id').notNull(),
  name: text('name'),
  slug: text('slug').notNull(),
  image: text('image').notNull().default(''),
  imageList: jsonb('image_list').default([]),
  variantSelections: jsonb('variant_selections'),
  originalPrice: doublePrecision('original_price').default(0),
  currentPrice: doublePrecision('current_price').default(0),
  shippingComponents: jsonb('shipping_components'),
  featuredSection: text('featured_section'),
  featuredImage: text('featured_image').default(''),
  tags: jsonb('tags').default([]),
  score: doublePrecision('score').default(0),
  ratings: integer('ratings').default(0),
  shortDescription: text('short_description').default(''),
  longDescription: text('long_description').default(''),
  marketingPhrase: text('marketing_phrase').default(''),
  status: text('status').default('pendiente'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  productImage: text('product_image').notNull(),
  bgImage: text('bg_image').notNull(),
  models: integer('models').default(0),
  variants: jsonb('variants').default([]),
});

export const shippingConfig = pgTable('shipping_config', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().unique(),
  categoryName: text('category_name').notNull(),
  tiers: jsonb('tiers').notNull(),
  extraUnitFactor: doublePrecision('extra_unit_factor').default(0.5),
});
