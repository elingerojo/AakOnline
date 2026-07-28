import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories } from '../schema/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// ── JSON helpers ─────────────────────────────────────────────────────────────

function getDataDir(): string {
  return resolve(__dirname, '..', '..', process.env.DATA_DIR ?? '../src/app/core/data');
}

function getCategoriesPath(): string {
  return resolve(getDataDir(), 'categories.json');
}

function readCategories(): any[] {
  const path = getCategoriesPath();
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeCategories(categories: any[]): void {
  writeFileSync(getCategoriesPath(), JSON.stringify(categories, null, 2));
}

// ── Neon helpers ─────────────────────────────────────────────────────────────

async function upsertCategoryToNeon(cat: any): Promise<void> {
  try {
    await db.insert(categories)
      .values({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        productImage: cat.productImage ?? '',
        bgImage: cat.bgImage ?? '',
        models: cat.models ?? 0,
        variants: cat.variants ?? [],
      })
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name: cat.name,
          slug: cat.slug,
          productImage: cat.productImage ?? '',
          bgImage: cat.bgImage ?? '',
          models: cat.models ?? 0,
          variants: cat.variants ?? [],
        },
      });
  } catch (error) {
    console.error('[Neon] Error upserting category:', error);
  }
}

async function deleteCategoryFromNeon(id: number): Promise<void> {
  try {
    await db.delete(categories).where(eq(categories.id, id));
  } catch (error) {
    console.error('[Neon] Error deleting category:', error);
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/categories — Lee de JSON
router.get('/', (_req, res) => {
  const data = readCategories();
  res.json(data);
});

// POST /api/categories — Escribe en JSON + Neon
router.post('/', async (req, res) => {
  const data = readCategories();
  const maxId = data.reduce((max: number, c: any) => Math.max(max, c.id), 0);
  const newCategory = {
    id: maxId + 1,
    ...req.body,
  };

  // JSON
  data.push(newCategory);
  writeCategories(data);

  // Neon
  await upsertCategoryToNeon(newCategory);

  res.status(201).json(newCategory);
});

// PUT /api/categories/:id — Actualiza en JSON + Neon
router.put('/:id', async (req, res) => {
  const data = readCategories();
  const index = data.findIndex(c => c.id === parseInt(req.params.id));

  if (index === -1) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  const updated = {
    ...data[index],
    ...req.body,
    id: data[index].id,
  };

  // JSON
  data[index] = updated;
  writeCategories(data);

  // Neon
  await upsertCategoryToNeon(updated);

  res.json(updated);
});

// DELETE /api/categories/:id — Elimina de JSON + Neon
router.delete('/:id', async (req, res) => {
  const data = readCategories();
  const filtered = data.filter(c => c.id !== parseInt(req.params.id));

  if (filtered.length === data.length) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  // JSON
  writeCategories(filtered);

  // Neon
  await deleteCategoryFromNeon(parseInt(req.params.id));

  res.json({ success: true });
});

export default router;
