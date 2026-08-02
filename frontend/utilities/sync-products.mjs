/**
 * sync-products.mjs — Sincroniza el catálogo de Neon → products.json (build-time)
 *
 * Hace un solo GET a /api/products (Railway). El servidor ya realiza el merge
 * Neon-first (Neon sobrescribe por ID + agrega productos creados en admin), así
 * que la respuesta ES el catálogo completo listo para el build.
 *
 * Este script solo persiste esa respuesta en products.json, con una guarda de
 * "catálogo plausible": si la respuesta es parcial o vacía (p. ej. si Railway
 * perdiera acceso al JSON fallback, o Neon y JSON cayeran a la vez), NO
 * sobrescribe y el build continúa con el products.json existente.
 *
 * Uso:
 *   - Desde prebuild.mjs:  import { syncProducts } from './sync-products.mjs'
 *   - Manual:              node utilities/sync-products.mjs
 *
 * Env:
 *   AAK_API_BASE_URL     default https://aakonline-production.up.railway.app/api
 *   AAK_SYNC_PRODUCTS=0  desactiva el sync
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const DEFAULT_API_BASE_URL = 'https://aakonline-production.up.railway.app/api';
const PRODUCTS_PATH = join(root, 'src', 'app', 'core', 'data', 'products.json');
const TIMEOUT_MS = 15000;

/**
 * Fetch del catálogo mergeado desde Railway y sobreescritura de products.json.
 * Nunca lanza: cualquier fallo conserva el archivo actual.
 */
async function syncProducts({ baseUrl, timeoutMs } = {}) {
  const apiBase = baseUrl ?? process.env.AAK_API_BASE_URL ?? DEFAULT_API_BASE_URL;

  if (process.env.AAK_SYNC_PRODUCTS === '0') {
    console.log('[sync-products] ⏭️  Skip (AAK_SYNC_PRODUCTS=0)');
    return { synced: false, reason: 'skipped' };
  }

  if (!existsSync(PRODUCTS_PATH)) {
    console.warn('[sync-products] ⚠️  products.json no encontrado, se omite sync:', PRODUCTS_PATH);
    return { synced: false, reason: 'no-local-file' };
  }

  // 1) Fetch del catálogo ya mergeado (Neon-first) desde Railway
  let remote;
  try {
    const res = await fetch(`${apiBase}/products`, {
      signal: AbortSignal.timeout(timeoutMs ?? TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    remote = await res.json();
  } catch (err) {
    console.warn(
      `[sync-products] ⚠️  Railway no disponible (${err.message}). Se conserva products.json.`
    );
    return { synced: false, reason: 'fetch-failed' };
  }

  // 2) Validaciones — nunca vaciar el catálogo
  if (!Array.isArray(remote)) {
    console.warn('[sync-products] ⚠️  Respuesta inválida (no es array). Se conserva products.json.');
    return { synced: false, reason: 'invalid-response' };
  }
  if (remote.length === 0) {
    console.warn('[sync-products] ⚠️  Respuesta vacía. Se conserva products.json.');
    return { synced: false, reason: 'empty-response' };
  }

  // 3) Guarda de catálogo plausible: respuesta parcial → no sobrescribir
  let localCount = 0;
  try {
    localCount = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf-8')).length;
  } catch {
    localCount = 0; // archivo inválido: se deja pasar (prebuild ya verifica el JSON)
  }
  if (remote.length < localCount) {
    console.warn(
      `[sync-products] ⚠️  Respuesta parcial (${remote.length} < local ${localCount}). Se conserva products.json.`
    );
    return { synced: false, reason: 'partial-response' };
  }

  // 4) Sobrescribir con el catálogo mergeado
  writeFileSync(PRODUCTS_PATH, JSON.stringify(remote, null, 2) + '\n');
  console.log(`[sync-products] ✅ products.json actualizado: ${remote.length} productos`);
  return { synced: true, total: remote.length };
}

// Ejecución standalone: node utilities/sync-products.mjs
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  syncProducts().catch((err) => {
    console.warn('[sync-products] ⚠️  Error inesperado:', err.message);
  });
}

export { syncProducts };
