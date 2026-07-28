import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

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

// GET /api/shipping-config
router.get('/', (_req, res) => {
  const config = readConfig();
  res.json(config);
});

// PUT /api/shipping-config
router.put('/', (req, res) => {
  const { categories, defaultExtraUnitFactor } = req.body;
  const current = readConfig();

  const updated = {
    categories: categories ?? current.categories,
    defaultExtraUnitFactor: defaultExtraUnitFactor ?? current.defaultExtraUnitFactor,
  };

  writeConfig(updated);
  res.json(updated);
});

export default router;
