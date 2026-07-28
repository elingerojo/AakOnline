/**
 * Seed script — Puebla Neon con datos iniciales desde JSON.
 *
 * Uso: npx tsx src/seed.ts
 *
 * Es IDEMPOTENTE: solo inserta registros que NO existen en Neon.
 * Los productos que ya existen (migrados vía admin/Gemini) no se duplican.
 */
import { config } from 'dotenv';
config();

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from './db/index.js';
import { products, categories, shippingConfig } from './schema/index.js';
import { eq } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR = resolve(__dirname, '..', 'shared', 'data');
const PRODUCTS_PATH = resolve(DATA_DIR, 'products.json');
const CATEGORIES_PATH = resolve(DATA_DIR, 'categories.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJson<T>(path: string): T[] {
  if (!existsSync(path)) {
    console.warn(`[Seed] File not found: ${path}`);
    return [];
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ── Seed Functions ───────────────────────────────────────────────────────────

async function seedCategories(): Promise<number> {
  const items = readJson<any>(CATEGORIES_PATH);
  let count = 0;

  for (const cat of items) {
    try {
      // Verificar si ya existe
      const existing = await db.select().from(categories).where(eq(categories.id, cat.id)).limit(1);

      if (existing.length === 0) {
        await db.insert(categories).values({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          productImage: cat.productImage ?? '',
          bgImage: cat.bgImage ?? '',
          models: cat.models ?? 0,
          variants: cat.variants ?? [],
        });
        console.log(`[Seed] ✅ Category inserted: ${cat.name} (id=${cat.id})`);
        count++;
      } else {
        console.log(`[Seed] ⏭️  Category exists, skipped: ${cat.name} (id=${cat.id})`);
      }
    } catch (error) {
      console.error(`[Seed] ❌ Error inserting category ${cat.id}:`, error);
    }
  }

  return count;
}

async function seedProducts(): Promise<number> {
  const items = readJson<any>(PRODUCTS_PATH);
  let count = 0;

  for (const prod of items) {
    try {
      // Verificar si ya existe
      const existing = await db.select().from(products).where(eq(products.id, prod.id)).limit(1);

      if (existing.length === 0) {
        await db.insert(products).values({
          id: prod.id,
          sku: prod.sku ?? `SKU-${prod.id}`,
          categoryId: prod.categoryId,
          name: prod.name,
          slug: prod.slug ?? `producto-${prod.id}`,
          image: prod.image ?? '',
          imageList: prod.imageList ?? [],
          variantSelections: prod.variantSelections ?? null,
          originalPrice: prod.originalPrice ?? 0,
          currentPrice: prod.currentPrice ?? 0,
          shippingComponents: prod.shippingComponents ?? null,
          taggedSection: prod.taggedSection ?? null,
          featuredImage: prod.featuredImage ?? '',
          featureTag: prod.featureTag ?? '',
          tags: prod.tags ?? [],
          score: prod.score ?? 0,
          ratings: prod.ratings ?? 0,
          shortDescription: prod.shortDescription ?? '',
          longDescription: prod.longDescription ?? '',
          marketingPhrase: prod.marketingPhrase ?? '',
          status: prod.status ?? 'pendiente',
          createdAt: prod.createdAt ? new Date(prod.createdAt) : new Date(),
          updatedAt: prod.updatedAt ? new Date(prod.updatedAt) : new Date(),
        });
        console.log(`[Seed] ✅ Product inserted: id=${prod.id}, slug=${prod.slug}`);
        count++;
      } else {
        console.log(`[Seed] ⏭️  Product exists, skipped: id=${prod.id}, slug=${prod.slug}`);
      }
    } catch (error) {
      console.error(`[Seed] ❌ Error inserting product ${prod.id}:`, error);
    }
  }

  return count;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('  🌱 Seed: Poblando Neon desde JSON');
  console.log('═══════════════════════════════════════════');
  console.log(`  Products:  ${PRODUCTS_PATH}`);
  console.log(`  Categories: ${CATEGORIES_PATH}`);
  console.log('');

  const catCount = await seedCategories();
  console.log(`\n📦 Categories: ${catCount} inserted, rest skipped`);

  const prodCount = await seedProducts();
  console.log(`📦 Products: ${prodCount} inserted, rest skipped`);

  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ Seed complete');
  console.log('═══════════════════════════════════════════');
}

main().catch((err) => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
