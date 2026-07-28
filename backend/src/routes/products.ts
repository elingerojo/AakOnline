import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products } from '../schema/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// ── JSON helpers ─────────────────────────────────────────────────────────────

function getDataDir(): string {
  return resolve(__dirname, '..', '..', process.env.DATA_DIR ?? '../src/app/core/data');
}

function getProductsPath(): string {
  return resolve(getDataDir(), 'products.json');
}

function readProducts(): any[] {
  const path = getProductsPath();
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeProducts(products: any[]): void {
  writeFileSync(getProductsPath(), JSON.stringify(products, null, 2));
}

// ── Neon helpers ─────────────────────────────────────────────────────────────

async function upsertProductToNeon(product: any): Promise<void> {
  try {
    await db.insert(products)
      .values({
        id: product.id,
        sku: product.sku ?? `SKU-${product.id}`,
        categoryId: product.categoryId,
        name: product.name,
        slug: product.slug ?? `producto-${product.id}`,
        image: product.image ?? '',
        imageList: product.imageList ?? [],
        variantSelections: product.variantSelections ?? null,
        originalPrice: product.originalPrice ?? 0,
        currentPrice: product.currentPrice ?? 0,
        shippingComponents: product.shippingComponents ?? null,
        taggedSection: product.taggedSection ?? null,
        featuredImage: product.featuredImage ?? '',
        featureTag: product.featureTag ?? '',
        tags: product.tags ?? [],
        score: product.score ?? 0,
        ratings: product.ratings ?? 0,
        shortDescription: product.shortDescription ?? '',
        longDescription: product.longDescription ?? '',
        marketingPhrase: product.marketingPhrase ?? '',
        status: product.status ?? 'pendiente',
        createdAt: product.createdAt ? new Date(product.createdAt) : new Date(),
        updatedAt: product.updatedAt ? new Date(product.updatedAt) : new Date(),
      })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          sku: product.sku ?? `SKU-${product.id}`,
          categoryId: product.categoryId,
          name: product.name,
          slug: product.slug ?? `producto-${product.id}`,
          image: product.image ?? '',
          imageList: product.imageList ?? [],
          variantSelections: product.variantSelections ?? null,
          originalPrice: product.originalPrice ?? 0,
          currentPrice: product.currentPrice ?? 0,
          shippingComponents: product.shippingComponents ?? null,
          taggedSection: product.taggedSection ?? null,
          featuredImage: product.featuredImage ?? '',
          featureTag: product.featureTag ?? '',
          tags: product.tags ?? [],
          score: product.score ?? 0,
          ratings: product.ratings ?? 0,
          shortDescription: product.shortDescription ?? '',
          longDescription: product.longDescription ?? '',
          marketingPhrase: product.marketingPhrase ?? '',
          status: product.status ?? 'pendiente',
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('[Neon] Error upserting product:', error);
    // Don't throw — JSON write already succeeded
  }
}

async function deleteProductFromNeon(id: number): Promise<void> {
  try {
    await db.delete(products).where(eq(products.id, id));
  } catch (error) {
    console.error('[Neon] Error deleting product:', error);
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/products — Lee de JSON (compatible con flujo actual)
router.get('/', (_req, res) => {
  const data = readProducts();
  res.json(data);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const data = readProducts();
  const product = data.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json(product);
});

// POST /api/products — Escribe en JSON + Neon
router.post('/', async (req, res) => {
  const data = readProducts();
  const maxId = data.reduce((max, p) => Math.max(max, p.id), 0);
  const now = new Date().toISOString();

  const newProduct = {
    id: maxId + 1,
    ...req.body,
    createdAt: now,
    updatedAt: now,
  };

  // Escribir en JSON
  data.push(newProduct);
  writeProducts(data);

  // Escribir en Neon (no bloquea la respuesta)
  await upsertProductToNeon(newProduct);

  res.status(201).json(newProduct);
});

// PUT /api/products/:id — Actualiza en JSON + Neon
router.put('/:id', async (req, res) => {
  const data = readProducts();
  const index = data.findIndex(p => p.id === parseInt(req.params.id));

  if (index === -1) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const updated = {
    ...data[index],
    ...req.body,
    id: data[index].id,
    updatedAt: new Date().toISOString(),
  };

  // Escribir en JSON
  data[index] = updated;
  writeProducts(data);

  // Escribir en Neon
  await upsertProductToNeon(updated);

  res.json(updated);
});

// DELETE /api/products/:id — Elimina de JSON + Neon
router.delete('/:id', async (req, res) => {
  const data = readProducts();
  const filtered = data.filter(p => p.id !== parseInt(req.params.id));

  if (filtered.length === data.length) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  // Eliminar de JSON
  writeProducts(filtered);

  // Eliminar de Neon
  await deleteProductFromNeon(parseInt(req.params.id));

  res.json({ success: true });
});

export default router;
