import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

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

// GET /api/products
router.get('/', (_req, res) => {
  const products = readProducts();
  res.json(products);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const products = readProducts();
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json(product);
});

// POST /api/products
router.post('/', (req, res) => {
  const products = readProducts();
  const maxId = products.reduce((max, p) => Math.max(max, p.id), 0);
  const now = new Date().toISOString();

  const newProduct = {
    id: maxId + 1,
    ...req.body,
    createdAt: now,
    updatedAt: now,
  };

  products.push(newProduct);
  writeProducts(products);
  res.status(201).json(newProduct);
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  const products = readProducts();
  const index = products.findIndex(p => p.id === parseInt(req.params.id));

  if (index === -1) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  products[index] = {
    ...products[index],
    ...req.body,
    id: products[index].id,
    updatedAt: new Date().toISOString(),
  };

  writeProducts(products);
  res.json(products[index]);
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  const products = readProducts();
  const filtered = products.filter(p => p.id !== parseInt(req.params.id));

  if (filtered.length === products.length) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  writeProducts(filtered);
  res.json({ success: true });
});

export default router;
