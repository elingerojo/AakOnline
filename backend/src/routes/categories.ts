import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories } from '../schema/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// ── JSON helpers (fallback) ──────────────────────────────────────────────────

function getCategoriesPath(): string {
  const dataDir = resolve(__dirname, '..', '..', process.env.DATA_DIR ?? '../src/app/core/data');
  return resolve(dataDir, 'categories.json');
}

function readJsonCategories(): any[] {
  const path = getCategoriesPath();
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ── Neon helpers ─────────────────────────────────────────────────────────────

async function readNeonCategories(): Promise<any[] | null> {
  try {
    return await db.select().from(categories);
  } catch (error) {
    console.warn('[Categories] Neon unavailable, falling back to JSON:', (error as Error).message);
    return null;
  }
}

function formatNeonCategory(c: any): any {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    productImage: c.productImage,
    bgImage: c.bgImage,
    models: c.models,
    variants: c.variants ?? [],
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/categories — Neon-first, JSON-fallback
router.get('/', async (_req, res) => {
  const neonCategories = await readNeonCategories();

  if (neonCategories !== null) {
    const jsonCategories = readJsonCategories();
    const neonMap = new Map(neonCategories.map(c => [c.id, formatNeonCategory(c)]));

    const merged = jsonCategories.map(jc => neonMap.get(jc.id) ?? jc);

    for (const [id, nc] of neonMap) {
      if (!jsonCategories.some(jc => jc.id === id)) {
        merged.push(nc);
      }
    }

    res.json(merged);
  } else {
    res.json(readJsonCategories());
  }
});

// POST /api/categories — Solo Neon
router.post('/', async (req, res) => {
  try {
    const newCategory = {
      name: req.body.name,
      slug: req.body.slug,
      productImage: req.body.productImage ?? '',
      bgImage: req.body.bgImage ?? '',
      models: req.body.models ?? 0,
      variants: req.body.variants ?? [],
    };

    const result = await db.insert(categories).values(newCategory).returning();
    res.status(201).json(formatNeonCategory(result[0]));
  } catch (error) {
    console.error('[Categories] Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id — Solo Neon (con migración natural desde JSON)
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const existing = await db.select().from(categories).where(eq(categories.id, id)).limit(1);

    if (existing.length > 0) {
      const updated = await db.update(categories)
        .set({
          name: req.body.name ?? existing[0].name,
          slug: req.body.slug ?? existing[0].slug,
          productImage: req.body.productImage ?? existing[0].productImage,
          bgImage: req.body.bgImage ?? existing[0].bgImage,
          models: req.body.models ?? existing[0].models,
          variants: req.body.variants ?? existing[0].variants,
        })
        .where(eq(categories.id, id))
        .returning();

      res.json(formatNeonCategory(updated[0]));
      return;
    }

    // No existe en Neon — migrar desde JSON
    const jsonCategories = readJsonCategories();
    const jsonCat = jsonCategories.find(c => c.id === id);

    if (jsonCat) {
      const migrated = {
        ...jsonCat,
        ...req.body,
        id,
      };

      const result = await db.insert(categories).values({
        id: migrated.id,
        name: migrated.name,
        slug: migrated.slug,
        productImage: migrated.productImage ?? '',
        bgImage: migrated.bgImage ?? '',
        models: migrated.models ?? 0,
        variants: migrated.variants ?? [],
      }).returning();

      console.log(`[Categories] 🚀 Category ${id} migrated from JSON to Neon`);
      res.json(formatNeonCategory(result[0]));
      return;
    }

    res.status(404).json({ error: 'Category not found' });
  } catch (error) {
    console.error('[Categories] Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id — Solo Neon
router.delete('/:id', async (req, res) => {
  try {
    await db.delete(categories).where(eq(categories.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    console.error('[Categories] Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
