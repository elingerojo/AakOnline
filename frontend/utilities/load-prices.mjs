/**
 * Load prices from CSV into products.json
 *
 * CSV format:
 *   ImageLocalPath,CurrentPrice
 *   assets/img/products/01-salas/001.png,"$24,500.00"
 *
 * Matching: by full image path (ImageLocalPath === product.image)
 *
 * Products NOT found in CSV → currentPrice stays 0 (shows "Consultar")
 * Products found but empty price → currentPrice stays 0
 * Products found with price → currentPrice + originalPrice (15% above) set
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const productsPath = join(root, 'src', 'app', 'core', 'data', 'products.json');
const csvPath = join(root, 'src', 'app', 'core', 'data', '2026-07-27-Precios-iniciales.csv');

// ── Simple CSV parser ──────────────────────────────────────
// Handles: path,"$24,500.00"  and  path,
function parseCsvLine(line) {
  const commaIdx = line.indexOf(',');
  if (commaIdx === -1) return null;
  
  const path = line.substring(0, commaIdx).trim();
  let priceRaw = line.substring(commaIdx + 1).trim();
  
  // Remove surrounding quotes
  if (priceRaw.startsWith('"') && priceRaw.endsWith('"')) {
    priceRaw = priceRaw.substring(1, priceRaw.length - 1);
  }
  
  priceRaw = priceRaw.trim();
  
  return { path, priceRaw };
}

// ── Parse CSV ──────────────────────────────────────────────
const csvRaw = readFileSync(csvPath, 'utf-8').trim();
const lines = csvRaw.split('\n');

const priceMap = new Map(); // key: image path → value: currentPrice | null

for (let i = 1; i < lines.length; i++) {
  const parsed = parseCsvLine(lines[i]);
  if (!parsed) continue;
  
  const { path, priceRaw } = parsed;
  
  if (priceRaw === '') {
    priceMap.set(path, null); // explicitly empty
    continue;
  }
  
  // Parse "$24,500.00" → 24500
  const price = parseFloat(priceRaw.replace(/[$,]/g, ''));
  
  if (!isNaN(price) && price > 0) {
    priceMap.set(path, price);
  } else {
    priceMap.set(path, null);
  }
}

// ── Update products.json ───────────────────────────────────
const products = JSON.parse(readFileSync(productsPath, 'utf-8'));

let updated = 0;
let skipped = 0;
let notFound = 0;

for (const product of products) {
  const imagePath = product.image;
  if (!imagePath) {
    skipped++;
    continue;
  }

  const price = priceMap.get(imagePath);

  if (price === undefined) {
    notFound++;
    continue;
  }

  if (price === null || price === 0) {
    skipped++;
    continue;
  }

  // Set prices
  product.currentPrice = price;
  product.originalPrice = Math.round(price * 1.15);
  product.status = 'activo';
  updated++;
}

// ── Write output ───────────────────────────────────────────
writeFileSync(productsPath, JSON.stringify(products, null, 2));

console.log('\n=== Carga de Precios ===\n');
console.log(`Total productos en JSON: ${products.length}`);
console.log(`Registros en CSV:         ${lines.length - 1}`);
console.log('');
console.log(`✅ Precios asignados:     ${updated}`);
console.log(`⏭️  Sin precio (en CSV):  ${skipped}`);
console.log(`❓ No encontrados en CSV: ${notFound}`);
console.log('');

if (updated > 0) {
  console.log(`Productos ahora con status "activo": ${updated}`);
  console.log(`Productos sin precio (currentPrice=0): ${skipped + notFound}`);
}
console.log('\n=== Listo ===\n');

// Also copy to admin-api/data/ if it exists
const adminDataPath = join(root, 'admin-api', 'data', 'products.json');
try {
  writeFileSync(adminDataPath, JSON.stringify(products, null, 2));
  console.log('✓ Copiado a admin-api/data/products.json');
} catch {
  console.log('⚠ No se copió a admin-api/data/');
}

// Print summary by category
const counts = {};
for (const p of products) {
  const cat = (p.image || '').split('/').slice(-2, -1)[0] || 'unknown';
  counts[cat] = counts[cat] || { total: 0, withPrice: 0, withoutPrice: 0 };
  counts[cat].total++;
  if (p.currentPrice > 0) counts[cat].withPrice++;
  else counts[cat].withoutPrice++;
}
console.log('\nResumen por categoría:');
for (const [cat, c] of Object.entries(counts)) {
  console.log(`  ${cat}: ${c.withPrice} con precio, ${c.withoutPrice} sin precio (${c.total} total)`);
}
