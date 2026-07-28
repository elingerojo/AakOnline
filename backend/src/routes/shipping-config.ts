import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/index.js';
import { shippingConfig } from '../schema/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// ── JSON helpers (fallback) ──────────────────────────────────────────────────

function getConfigPath(): string {
  return resolve(__dirname, '..', '..', '..', 'config', 'shipping-config.json');
}

function readJsonConfig(): any {
  const path = getConfigPath();
  if (!existsSync(path)) return { categories: [], defaultExtraUnitFactor: 0.5 };
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ── Neon helpers ─────────────────────────────────────────────────────────────

async function readNeonConfig(): Promise<any[] | null> {
  try {
    return await db.select().from(shippingConfig);
  } catch (error) {
    console.warn('[ShippingConfig] Neon unavailable, falling back to JSON:', (error as Error).message);
    return null;
  }
}

function formatNeonConfig(rows: any[]): { categories: any[]; defaultExtraUnitFactor: number } {
  return {
    categories: rows.map(r => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      tiers: r.tiers,
      extraUnitFactor: r.extraUnitFactor,
    })),
    defaultExtraUnitFactor: 0.5,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/shipping-config — Neon-first, JSON-fallback
router.get('/', async (_req, res) => {
  const neonRows = await readNeonConfig();

  if (neonRows !== null && neonRows.length > 0) {
    res.json(formatNeonConfig(neonRows));
  } else {
    res.json(readJsonConfig());
  }
});

// PUT /api/shipping-config — Solo Neon
router.put('/', async (req, res) => {
  const { categories: newCategories, defaultExtraUnitFactor } = req.body;

  try {
    // Reemplazar toda la configuración en Neon
    await db.delete(shippingConfig);

    for (const cat of (newCategories ?? [])) {
      await db.insert(shippingConfig).values({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        tiers: cat.tiers,
        extraUnitFactor: cat.extraUnitFactor ?? defaultExtraUnitFactor ?? 0.5,
      });
    }

    // Leer de vuelta para confirmar
    const saved = await db.select().from(shippingConfig);
    res.json(formatNeonConfig(saved));
  } catch (error) {
    console.error('[ShippingConfig] Error saving config:', error);
    res.status(500).json({ error: 'Failed to save shipping config' });
  }
});

export default router;
