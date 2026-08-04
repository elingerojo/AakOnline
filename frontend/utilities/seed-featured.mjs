/**
 * seed-featured.mjs — Normalizador de consistencia del catálogo (modelo nuevo).
 *
 * Ya NO fabrica productos destacados ni placeholders. Su único trabajo es dejar
 * los 81 productos lo más fieles posible a su dato actual, pero consistentes con
 * el modelo actual:
 *
 *   - featuredImage = gate para aparecer en CUALQUIER sección del Home.
 *   - featuredSection = sección ('destacados' | 'nuevos' | null).
 *   - tags = badges sobre la tarjeta (independientes de la sección).
 *   - featureTag fue eliminado del modelo.
 *
 * Reglas (solo lo indispensable):
 *   1. Normaliza tags a arreglo.
 *   2. Elimina restos defensivos de featureTag / taggedSection (legacy).
 *   3. Si un producto tiene featuredSection definida, garantiza featuredImage
 *      (el gate): si está vacía, usa la imagen principal. Sin esto, la sección
 *      no surtiría efecto.
 *   4. NO toca nombre, precios, score, ratings, status ni asigna secciones.
 *
 * Procesa frontend/src/app/core/data/products.json (fuente del build/admin) y
 * backend/shared/data/products.json (fuente del seed de Neon) para que todo el
 * catálogo quede consistente.
 *
 * Uso: node utilities/seed-featured.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const TARGETS = [
  join(ROOT, 'src', 'app', 'core', 'data', 'products.json'),
  join(ROOT, '..', 'backend', 'shared', 'data', 'products.json'),
];

function normalize(path) {
  if (!existsSync(path)) {
    console.warn(`[seed-featured] ⚠️  No existe: ${path}. Se omite.`);
    return;
  }

  const products = JSON.parse(readFileSync(path, 'utf8'));
  let withSection = 0;
  let imageCompleted = 0;
  let tagsFixed = 0;
  let legacyRemoved = 0;

  for (const p of products) {
    // 1) tags siempre como arreglo
    if (!Array.isArray(p.tags)) {
      p.tags = [];
      tagsFixed++;
    }

    // 2) Restos del modelo viejo (defensivo)
    if ('featureTag' in p) {
      delete p.featureTag;
      legacyRemoved++;
    }
    if ('taggedSection' in p) {
      delete p.taggedSection;
      legacyRemoved++;
    }

    // 3) Gate: si hay sección, garantizar featuredImage
    if (p.featuredSection) {
      withSection++;
      const fi = typeof p.featuredImage === 'string' ? p.featuredImage.trim() : '';
      if (!fi) {
        p.featuredImage = p.image || '';
        imageCompleted++;
      }
    }
  }

  writeFileSync(path, JSON.stringify(products, null, 2) + '\n');
  console.log(`[seed-featured] ✅ ${path}`);
  console.log(
    `   productos=${products.length}, con featuredSection=${withSection}, ` +
      `featuredImage completada=${imageCompleted}, tags normalizados=${tagsFixed}, ` +
      `legacy removido=${legacyRemoved}`
  );
}

console.log('=== seed-featured: normalización de consistencia ===\n');
for (const target of TARGETS) {
  normalize(target);
}
console.log('\n=== Listo. El Home muestra solo lo que el admin configure en featuredSection. ===');
