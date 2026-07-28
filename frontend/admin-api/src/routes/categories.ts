import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

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

// GET /api/categories
router.get('/', (_req, res) => {
  const categories = readCategories();
  res.json(categories);
});

// POST /api/categories
router.post('/', (req, res) => {
  const categories = readCategories();
  const maxId = categories.reduce((max: number, c: any) => Math.max(max, c.id), 0);
  const newCategory = {
    id: maxId + 1,
    ...req.body,
  };
  categories.push(newCategory);
  writeCategories(categories);
  res.status(201).json(newCategory);
});

// PUT /api/categories/:id
router.put('/:id', (req, res) => {
  const categories = readCategories();
  const index = categories.findIndex(c => c.id === parseInt(req.params.id));

  if (index === -1) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  categories[index] = {
    ...categories[index],
    ...req.body,
    id: categories[index].id,
  };

  writeCategories(categories);
  res.json(categories[index]);
});

export default router;
