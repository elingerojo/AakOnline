import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products } from '../schema/index.js';
import { ensureBlobUrl } from './images.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// ── JSON helpers (solo para fallback) ────────────────────────────────────────

function getDataDir(): string {
  return resolve(__dirname, '..', '..', '../frontend/src/app/core/data');
}

function getProductsPath(): string {
  return resolve(getDataDir(), 'products.json');
}

function readJsonProducts(): any[] {
  const path = getProductsPath();
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ── Neon helpers ─────────────────────────────────────────────────────────────

/**
 * Lee todos los productos desde Neon.
 * Retorna null si Neon no está disponible.
 */
async function readNeonProducts(): Promise<any[] | null> {
  try {
    return await db.select().from(products);
  } catch (error) {
    console.warn('[Products] Neon unavailable, falling back to JSON:', (error as Error).message);
    return null;
  }
}

/**
 * Lee un producto por ID desde Neon.
 */
async function readNeonProduct(id: number): Promise<any | null> {
  try {
    const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return result[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Obtiene el máximo ID entre Neon y JSON para generar el siguiente.
 */
async function getNextId(): Promise<number> {
  let neonMax = 0;
  try {
    const result = await db.select({ maxId: sql<number>`COALESCE(MAX(id), 0)` }).from(products);
    neonMax = result[0]?.maxId ?? 0;
  } catch {
    // Neon no disponible
  }

  const jsonProducts = readJsonProducts();
  const jsonMax = jsonProducts.reduce((max, p) => Math.max(max, p.id), 0);

  return Math.max(neonMax, jsonMax) + 1;
}

/**
 * Convierte un producto de la base de datos a formato API (snake_case → camelCase).
 */
function formatNeonProduct(p: any): any {
  return {
    id: p.id,
    sku: p.sku,
    categoryId: p.categoryId,
    name: p.name,
    slug: p.slug,
    image: p.image,
    imageList: p.imageList ?? [],
    variantSelections: p.variantSelections,
    originalPrice: p.originalPrice,
    currentPrice: p.currentPrice,
    shippingComponents: p.shippingComponents,
    featuredSection: p.featuredSection,
    featuredImage: p.featuredImage,
    tags: p.tags ?? [],
    score: p.score,
    ratings: p.ratings,
    shortDescription: p.shortDescription ?? '',
    longDescription: p.longDescription ?? '',
    marketingPhrase: p.marketingPhrase ?? '',
    status: p.status,
    createdAt: p.createdAt?.toISOString?.() ?? p.createdAt,
    updatedAt: p.updatedAt?.toISOString?.() ?? p.updatedAt,
  };
}

/**
 * Migra TODAS las imágenes locales (main + imageList) a Vercel Blob.
 * Si ya son URLs de Blob (https://...), las deja tal cual (idempotente).
 */
async function migrateImages(product: any): Promise<any> {
  // Imagen principal
  if (product.image && !product.image.startsWith('https://')) {
    product.image = await ensureBlobUrl(product.image);
  }

  // Imágenes de galería
  if (Array.isArray(product.imageList)) {
    product.imageList = await Promise.all(
      product.imageList.map(async (img: string) =>
        img.startsWith('https://') ? img : ensureBlobUrl(img)
      )
    );
  }

  return product;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/products — Neon-first, JSON-fallback (merge por ID)
router.get('/', async (_req, res) => {
  const neonProducts = await readNeonProducts();

  if (neonProducts !== null) {
    // Merge: Neon overrides JSON by ID
    const jsonProducts = readJsonProducts();
    const neonMap = new Map(neonProducts.map(p => [p.id, formatNeonProduct(p)]));

    const merged = jsonProducts.map(jp => neonMap.get(jp.id) ?? jp);

    // Agregar productos que están en Neon pero no en JSON (ej: creados desde admin)
    for (const [id, np] of neonMap) {
      if (!jsonProducts.some(jp => jp.id === id)) {
        merged.push(np);
      }
    }

    res.json(merged);
  } else {
    // Fallback solo JSON
    res.json(readJsonProducts());
  }
});

// GET /api/products/sku/:sku — Busca por SKU (Neon-first, JSON-fallback)
// Usado para localizar productos migrados a Neon (id puede diferir del JSON local)
router.get('/sku/:sku', async (req, res) => {
  const sku = req.params.sku;

  // Neon primero
  try {
    const neon = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
    if (neon[0]) {
      res.json(formatNeonProduct(neon[0]));
      return;
    }
  } catch (error) {
    console.warn('[Products] Neon unavailable for SKU lookup:', (error as Error).message);
  }

  // Fallback a JSON local
  const jsonProducts = readJsonProducts();
  const product = jsonProducts.find(p => p.sku === sku);
  if (product) {
    res.json(product);
    return;
  }

  res.status(404).json({ error: 'Product not found' });
});

// GET /api/products/:id — Neon-first, JSON-fallback
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  // Intentar Neon primero
  const neonProduct = await readNeonProduct(id);
  if (neonProduct) {
    res.json(formatNeonProduct(neonProduct));
    return;
  }

  // Fallback a JSON
  const jsonProducts = readJsonProducts();
  const product = jsonProducts.find(p => p.id === id);
  if (product) {
    res.json(product);
    return;
  }

  res.status(404).json({ error: 'Product not found' });
});

// POST /api/products — Solo Neon (fuente de verdad)
router.post('/', async (req, res) => {
  try {
    const now = new Date();
    const id = await getNextId();

    const newProduct = {
      id,
      sku: req.body.sku ?? `SKU-${id}`,
      categoryId: req.body.categoryId,
      name: req.body.name ?? null,
      slug: req.body.slug ?? `producto-${id}`,
      image: req.body.image ?? '',
      imageList: req.body.imageList ?? [],
      variantSelections: req.body.variantSelections ?? null,
      originalPrice: req.body.originalPrice ?? 0,
      currentPrice: req.body.currentPrice ?? 0,
      shippingComponents: req.body.shippingComponents ?? null,
      featuredSection: req.body.featuredSection ?? null,
      featuredImage: req.body.featuredImage ?? '',
      tags: req.body.tags ?? [],
      score: req.body.score ?? 0,
      ratings: req.body.ratings ?? 0,
      shortDescription: req.body.shortDescription ?? '',
      longDescription: req.body.longDescription ?? '',
      marketingPhrase: req.body.marketingPhrase ?? '',
      status: req.body.status ?? 'pendiente',
      createdAt: now,
      updatedAt: now,
    };

    // Migrar imágenes locales a Vercel Blob antes de guardar
    await migrateImages(newProduct);

    const result = await db.insert(products).values(newProduct).returning();
    res.status(201).json(formatNeonProduct(result[0]));
  } catch (error) {
    console.error('[Products] Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id — Solo Neon
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    // Migrar imágenes locales a Vercel Blob antes de actualizar
    await migrateImages(req.body);

    // Verificar si existe en Neon
    const existing = await readNeonProduct(id);

    if (existing) {
      // Actualizar en Neon
      const updated = await db.update(products)
        .set({
          sku: req.body.sku ?? existing.sku,
          categoryId: req.body.categoryId ?? existing.categoryId,
          name: req.body.name !== undefined ? req.body.name : existing.name,
          slug: req.body.slug ?? existing.slug,
          image: req.body.image ?? existing.image,
          imageList: req.body.imageList ?? existing.imageList,
          variantSelections: req.body.variantSelections !== undefined ? req.body.variantSelections : existing.variantSelections,
          originalPrice: req.body.originalPrice ?? existing.originalPrice,
          currentPrice: req.body.currentPrice ?? existing.currentPrice,
          shippingComponents: req.body.shippingComponents !== undefined ? req.body.shippingComponents : existing.shippingComponents,
          featuredSection: req.body.featuredSection !== undefined ? req.body.featuredSection : existing.featuredSection,
          featuredImage: req.body.featuredImage ?? existing.featuredImage,
          tags: req.body.tags ?? existing.tags,
          score: req.body.score ?? existing.score,
          ratings: req.body.ratings ?? existing.ratings,
          shortDescription: req.body.shortDescription ?? existing.shortDescription,
          longDescription: req.body.longDescription ?? existing.longDescription,
          marketingPhrase: req.body.marketingPhrase ?? existing.marketingPhrase,
          status: req.body.status ?? existing.status,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning();

      res.json(formatNeonProduct(updated[0]));
      return;
    }

    // No existe en Neon — verificar si existe en JSON (migración natural)
    const jsonProducts = readJsonProducts();
    const jsonProduct = jsonProducts.find(p => p.id === id);

    if (jsonProduct) {
      // Migrar a Neon (primera vez que se edita)
      const migrated = {
        ...jsonProduct,
        ...req.body,
        id,
        updatedAt: new Date(),
      };

      const result = await db.insert(products).values({
        id: migrated.id,
        sku: migrated.sku ?? `SKU-${id}`,
        categoryId: migrated.categoryId,
        name: migrated.name,
        slug: migrated.slug ?? `producto-${id}`,
        image: migrated.image ?? '',
        imageList: migrated.imageList ?? [],
        variantSelections: migrated.variantSelections ?? null,
        originalPrice: migrated.originalPrice ?? 0,
        currentPrice: migrated.currentPrice ?? 0,
        shippingComponents: migrated.shippingComponents ?? null,
        featuredSection: migrated.featuredSection ?? null,
        featuredImage: migrated.featuredImage ?? '',
        tags: migrated.tags ?? [],
        score: migrated.score ?? 0,
        ratings: migrated.ratings ?? 0,
        shortDescription: migrated.shortDescription ?? '',
        longDescription: migrated.longDescription ?? '',
        marketingPhrase: migrated.marketingPhrase ?? '',
        status: migrated.status ?? 'pendiente',
        createdAt: migrated.createdAt ? new Date(migrated.createdAt) : new Date(),
        updatedAt: new Date(),
      }).returning();

      console.log(`[Products] 🚀 Product ${id} migrated from JSON to Neon`);
      res.json(formatNeonProduct(result[0]));
      return;
    }

    res.status(404).json({ error: 'Product not found' });
  } catch (error) {
    console.error('[Products] Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id — Solo Neon
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const result = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });

    if (result.length === 0) {
      // No existe en Neon — podría estar solo en JSON
      // Como no escribimos en JSON, consideramos éxito si no existe
      console.log(`[Products] Product ${id} not in Neon (may still be in JSON), returning success`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Products] Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
