import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const productsPath = join(__dirname, '..', 'src', 'app', 'core', 'data', 'products.json');

const products = JSON.parse(readFileSync(productsPath, 'utf8'));
console.log(`Total products: ${products.length}`);

// Pick 6 products spread across different categories
const pickIndices = [0, 10, 20, 30, 40, 50];

pickIndices.forEach((idx, i) => {
  if (idx >= products.length) return;
  const p = products[idx];
  p.featuredImage = p.image || '';
  p.currentPrice = 2500 + (i * 1200);
  p.originalPrice = p.currentPrice + 800 + (i * 200);
  p.score = 4.5 + (i * 0.1);
  p.ratings = 5 + i;
  p.status = 'activo';
  p.name = `Producto Destacado ${idx + 1}`;
  p.tags = p.tags || [];
  p.featureTag = i < 2 ? `-${10 + i * 5}%` : '';
  if (i >= 3) {
    if (!p.tags.includes('nuevo')) p.tags.push('nuevo');
  }
  console.log(`  [${idx}] id=${p.id}, cat=${p.categoryId}, image=${p.image?.substring(0, 40)}..., featuredImage set`);
});

writeFileSync(productsPath, JSON.stringify(products, null, 2));
console.log('Done!');
