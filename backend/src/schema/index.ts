import { pgTable, serial, integer, text, doublePrecision, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

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

/**
 * Eventos de tráfico y comportamiento del catálogo (sin PII).
 * visitorId = UUID persistente de SessionService (localStorage), nunca IP ni user-agent.
 */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: serial('id').primaryKey(),
    type: text('type').notNull(),
    path: text('path').notNull(),
    productId: integer('product_id'),
    categoryId: integer('category_id'),
    visitorId: text('visitor_id').notNull(),
    sessionId: text('session_id'),
    referrerHost: text('referrer_host'),
    device: text('device'),
    value: doublePrecision('value'),
    meta: jsonb('meta').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('analytics_events_created_at_idx').on(table.createdAt),
    index('analytics_events_type_created_at_idx').on(table.type, table.createdAt),
    index('analytics_events_product_id_idx').on(table.productId),
    index('analytics_events_path_idx').on(table.path),
  ]
);

/**
 * Snapshot de Google Search Console (clics, impresiones, CTR, posición,
 * consultas, páginas y dispositivos). El payload completo se cachea como
 * jsonb para que el panel no consulte Google en cada carga.
 */
export const seoSnapshots = pgTable(
  'seo_snapshots',
  {
    id: serial('id').primaryKey(),
    siteUrl: text('site_url').notNull(),
    days: integer('days').notNull(),
    version: integer('version').notNull().default(1),
    payload: jsonb('payload').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('seo_snapshots_site_days_fetched_at_idx').on(table.siteUrl, table.days, table.fetchedAt),
  ]
);

/**
 * Estado de la última sincronización con Search Console (fila única id = 1).
 * `lastError` guarda solo el mensaje de Google: nunca llaves ni tokens.
 */
export const seoSyncState = pgTable('seo_sync_state', {
  id: integer('id').primaryKey().default(1),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastError: text('last_error'),
});
