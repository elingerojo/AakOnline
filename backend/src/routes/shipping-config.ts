import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { shippingConfig } from '../schema/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// ── JSON helpers ─────────────────────────────────────────────────────────────

function getConfigPath(): string {
  return resolve(__dirname, '..', '..', '..', 'config', 'shipping-config.json');
}

function readConfig(): any {
  const path = getConfigPath();
  if (!existsSync(path)) return { categories: [], defaultExtraUnitFactor: 0.5 };
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeConfig(config: any): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// ── Neon helpers ─────────────────────────────────────────────────────────────

async function upsertShippingConfigToNeon(config: any): Promise<void> {
  try {
    for (const cat of config.categories ?? []) {
      await db.insert(shippingConfig)
        .values({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          tiers: cat.tiers,
          extraUnitFactor: cat.extraUnitFactor ?? config.defaultExtraUnitFactor ?? 0.5,
        })
        .onConflictDoUpdate({
          target: shippingConfig.categoryId,
          set: {
            categoryName: cat.categoryName,
            tiers: cat.tiers,
            extraUnitFactor: cat.extraUnitFactor ?? config.defaultExtraUnitFactor ?? 0.5,
          },
        });
    }
  } catch (error) {
    console.error('[Neon] Error upserting shipping config:', error);
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/shipping-config — Lee de JSON
router.get('/', (_req, res) => {
  const config = readConfig();
  res.json(config);
});

// PUT /api/shipping-config — Actualiza en JSON + Neon
router.put('/', async (req, res) => {
  const { categories: newCategories, defaultExtraUnitFactor } = req.body;
  const current = readConfig();

  const updated = {
    categories: newCategories ?? current.categories,
    defaultExtraUnitFactor: defaultExtraUnitFactor ?? current.defaultExtraUnitFactor,
  };

  // JSON
  writeConfig(updated);

  // Neon
  await upsertShippingConfigToNeon(updated);

  res.json(updated);
});

export default router;
