/**
 * seo-opportunities.util.ts — Convierte el snapshot de Search Console en
 * acciones concretas sobre el catálogo.
 *
 * Reglas (Corte 4b):
 * - `lowCtr`          → página con impresiones ≥ 100 y CTR < 2 %.
 * - `noClicks`        → página con impresiones ≥ 50 y cero clics.
 * - `noImpressions`   → producto `activo` cuyo `/product/<slug>` no aparece en
 *                       las páginas reportadas por Google.
 * - `pendingInvisible`→ producto no `activo`: no genera página estática, así
 *                       que no puede aparecer en Google.
 *
 * Sin dependencias: solo tipos y funciones puras (testeables sin Angular).
 */

import type { Product } from '@shared/models/product.model';
import type { SeoPageQueryRow, SeoSnapshot } from './seo.service';

export type OpportunityKind = 'lowCtr' | 'noClicks' | 'noImpressions' | 'pendingInvisible';

export interface OpportunityRow {
  kind: OpportunityKind;
  /** Ruta interna normalizada (`/product/<slug>`, `/shop`, `/`...). */
  path: string;
  /** Producto asociado, si la página es de producto o si la fila nace del catálogo. */
  productId?: number;
  sku?: string;
  name?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  /** Hasta 3 consultas que generaron impresiones en la página (v2). */
  topQueries: string[];
  action: string;
}

export const OPPORTUNITY_LABELS: Record<OpportunityKind, string> = {
  lowCtr: 'CTR bajo',
  noClicks: 'Sin clics',
  noImpressions: 'Sin impresiones',
  pendingInvisible: 'Invisible para Google',
};

export const OPPORTUNITY_ACTIONS: Record<OpportunityKind, string> = {
  lowCtr: 'Reescribir título/meta',
  noClicks: 'Revisar intención y precio',
  noImpressions: 'Solicitar indexación',
  pendingInvisible: 'Completar con Gemini y activar',
};

const PRODUCT_PREFIX = '/product/';
const MIN_IMPRESSIONS_LOW_CTR = 100;
const LOW_CTR_THRESHOLD = 0.02;
const MIN_IMPRESSIONS_NO_CLICKS = 50;
const TOP_QUERIES = 3;
export const MAX_OPPORTUNITY_ROWS = 50;

const KIND_ORDER: Record<OpportunityKind, number> = {
  noClicks: 0,
  lowCtr: 1,
  noImpressions: 2,
  pendingInvisible: 3,
};

/**
 * Google reporta URLs absolutas y normalmente con slash final. Se compara
 * siempre como ruta interna en minúsculas y sin slash final.
 */
export function normalizePath(pageUrl: string): string {
  const raw = (pageUrl ?? '').trim();
  if (raw.length === 0) return '';

  let pathname: string;
  try {
    pathname = new URL(raw).pathname || '/';
  } catch {
    pathname = raw.split(/[?#]/)[0] || '/';
  }

  const withoutTrailingSlash = pathname.replace(/\/+$/, '');
  const normalized = withoutTrailingSlash.length > 0 ? withoutTrailingSlash : '/';
  return normalized.toLowerCase();
}

/** Producto cuyo `/product/<slug>` coincide con la ruta (ya normalizada). */
export function matchProduct(
  path: string,
  products: readonly Product[]
): Product | undefined {
  const normalized = normalizePath(path);
  if (!normalized.startsWith(PRODUCT_PREFIX)) return undefined;

  const slug = decodeURIComponent(normalized.slice(PRODUCT_PREFIX.length));
  if (slug.length === 0) return undefined;

  return products.find((product) => (product.slug ?? '').toLowerCase() === slug);
}

/** Clasifica una página según sus métricas; `null` si no hay oportunidad. */
export function classifyPage(
  impressions: number,
  clicks: number,
  ctr: number
): 'lowCtr' | 'noClicks' | null {
  const safeImpressions = Number.isFinite(impressions) ? impressions : 0;
  const safeClicks = Number.isFinite(clicks) ? clicks : 0;
  const safeCtr = Number.isFinite(ctr) ? ctr : 0;

  if (safeImpressions >= MIN_IMPRESSIONS_NO_CLICKS && safeClicks === 0) return 'noClicks';
  if (safeImpressions >= MIN_IMPRESSIONS_LOW_CTR && safeCtr < LOW_CTR_THRESHOLD) return 'lowCtr';
  return null;
}

/** Índice ruta → consultas ordenadas por impresiones (solo snapshot v2). */
function buildQueryIndex(pageQueries: readonly SeoPageQueryRow[]): Map<string, SeoPageQueryRow[]> {
  const index = new Map<string, SeoPageQueryRow[]>();
  for (const row of pageQueries) {
    const path = normalizePath(row.page);
    if (path.length === 0) continue;
    const bucket = index.get(path);
    if (bucket) bucket.push(row);
    else index.set(path, [row]);
  }
  for (const bucket of index.values()) {
    bucket.sort((a, b) => b.impressions - a.impressions);
  }
  return index;
}

function topQueriesFor(index: Map<string, SeoPageQueryRow[]>, path: string): string[] {
  return (index.get(path) ?? [])
    .slice(0, TOP_QUERIES)
    .map((row) => row.query);
}

/**
 * Construye la lista de oportunidades: primero las páginas con métricas
 * pobres, después los productos que Google no puede mostrar. Orden por
 * impresiones descendente y máximo `limit` filas.
 */
export function buildOpportunities(
  snapshot: SeoSnapshot | null | undefined,
  products: readonly Product[],
  limit: number = MAX_OPPORTUNITY_ROWS
): OpportunityRow[] {
  if (!snapshot) return [];

  const rows: OpportunityRow[] = [];
  const queryIndex = buildQueryIndex(snapshot.pageQueries ?? []);
  const seenPaths = new Set<string>();

  for (const page of snapshot.pages ?? []) {
    const path = normalizePath(page.page);
    if (path.length === 0) continue;

    const kind = classifyPage(page.impressions, page.clicks, page.ctr);
    if (!kind) continue;

    seenPaths.add(path);
    const product = matchProduct(path, products);
    rows.push({
      kind,
      path,
      productId: product?.id,
      sku: product?.sku,
      name: product?.name?.trim() || undefined,
      impressions: page.impressions,
      clicks: page.clicks,
      ctr: page.ctr,
      position: page.position,
      topQueries: topQueriesFor(queryIndex, path),
      action: OPPORTUNITY_ACTIONS[kind],
    });
  }

  for (const product of products) {
    const slug = (product.slug ?? '').trim().toLowerCase();
    if (slug.length === 0) continue;

    const path = `${PRODUCT_PREFIX}${slug}`;
    const isActive = product.status === 'activo';

    if (isActive && seenPaths.has(path)) continue;

    const kind: OpportunityKind = isActive ? 'noImpressions' : 'pendingInvisible';
    rows.push({
      kind,
      path,
      productId: product.id,
      sku: product.sku,
      name: product.name?.trim() || undefined,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      position: 0,
      topQueries: topQueriesFor(queryIndex, path),
      action: OPPORTUNITY_ACTIONS[kind],
    });
  }

  rows.sort(
    (a, b) =>
      b.impressions - a.impressions ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.name ?? a.path).localeCompare(b.name ?? b.path, 'es')
  );

  return rows.slice(0, Math.max(0, limit));
}

/** Contadores por tipo para las tarjetas superiores. */
export function countOpportunities(
  rows: readonly OpportunityRow[]
): Record<OpportunityKind, number> {
  const counts: Record<OpportunityKind, number> = {
    lowCtr: 0,
    noClicks: 0,
    noImpressions: 0,
    pendingInvisible: 0,
  };
  for (const row of rows) counts[row.kind] += 1;
  return counts;
}
