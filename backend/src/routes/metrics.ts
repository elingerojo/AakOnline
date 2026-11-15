/**
 * metrics.ts — Ingesta y agregación de métricas propias (sin PII, sin GA4).
 *
 *   POST /api/metrics/events         → 202 { accepted, rejected }
 *   GET  /api/metrics/summary        → agregados por día (America/Mexico_City)
 *   GET  /api/metrics/health         → { ok, lastEventAt }
 *   GET  /api/metrics/health-summary → errores JS y Core Web Vitals (p75)
 *   POST /api/metrics/purge          → borra eventos fuera de retención
 *
 * Reglas: nunca se guarda IP ni user-agent; solo visitorId/sessionId opacos
 * generados en el navegador. Si Neon falla se responde 503 y el resto de la
 * API sigue funcionando.
 */

import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { analyticsEvents } from '../schema/index.js';

const router = Router();

// ── Configuración ───────────────────────────────────────────────────────────

const EVENT_TYPES = new Set<string>([
  'page_view',
  'product_view',
  'category_view',
  'add_to_quote',
  'quote_open',
  'pdf_download',
  'contact_click',
  'shipping_calc',
  'search',
  'wishlist_add',
  'js_error',
  'web_vital',
]);

const DEVICES = new Set<string>(['mobile', 'tablet', 'desktop']);
const ALLOWED_RANGES = new Set<number>([7, 30, 90]);

const MAX_BATCH = 50;
const MAX_META_BYTES = 1024;
const RATE_LIMIT_MAX = 300;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RETENTION_DAYS = 90;
const TIMEZONE = 'America/Mexico_City';

/** Salud del sitio: errores JS y Core Web Vitals. */
type VitalMetric = 'lcp' | 'inp' | 'cls';
const MAX_ERROR_GROUPS = 10;
const MAX_ERROR_MESSAGE_LENGTH = 200;

// ── Rate limit en memoria (por visitorId) ───────────────────────────────────

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

function isRateLimited(visitorId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(visitorId);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(visitorId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (rateBuckets.size > 5_000) pruneRateBuckets(now);
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function pruneRateBuckets(now: number): void {
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}

// ── Validación / saneamiento de eventos ─────────────────────────────────────

interface CleanEvent {
  type: string;
  path: string;
  productId: number | null;
  categoryId: number | null;
  visitorId: string;
  sessionId: string | null;
  referrerHost: string | null;
  device: string | null;
  value: number | null;
  meta: Record<string, unknown>;
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const int = Math.trunc(value);
  return int > 0 && int <= 2_147_483_647 ? int : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function sanitizeMeta(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_META_BYTES) return {};
    return JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sanitizeEvent(raw: unknown): CleanEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const type = typeof record['type'] === 'string' ? record['type'] : '';
  if (!EVENT_TYPES.has(type)) return null;

  const path = typeof record['path'] === 'string' ? record['path'].trim() : '';
  if (path.length < 1 || path.length > 300) return null;

  const visitorId = typeof record['visitorId'] === 'string' ? record['visitorId'].trim() : '';
  if (visitorId.length < 8 || visitorId.length > 64) return null;

  const rawSession = typeof record['sessionId'] === 'string' ? record['sessionId'].trim() : '';
  const sessionId = rawSession.length > 0 && rawSession.length <= 64 ? rawSession : null;

  const rawReferrer = typeof record['referrerHost'] === 'string' ? record['referrerHost'].trim() : '';
  const referrerHost = rawReferrer.length > 0 && rawReferrer.length <= 120 ? rawReferrer : null;

  const rawDevice = typeof record['device'] === 'string' ? record['device'].trim() : '';
  const device = DEVICES.has(rawDevice) ? rawDevice : null;

  return {
    type,
    path,
    productId: asPositiveInt(record['productId']),
    categoryId: asPositiveInt(record['categoryId']),
    visitorId,
    sessionId,
    referrerHost,
    device,
    value: asFiniteNumber(record['value']),
    meta: sanitizeMeta(record['meta']),
  };
}

// ── Helpers de fecha (America/Mexico_City) ──────────────────────────────────

function mexicoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

function addDays(isoDate: string, delta: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * Expresión del día local (America/Mexico_City) en formato YYYY-MM-DD.
 * La zona se inlinea como literal (constante del código) para que SELECT,
 * GROUP BY y ORDER BY sean textualmente idénticos: si viajara como parámetro,
 * PostgreSQL recibiría $1/$2 distintos y rechazaría el GROUP BY.
 */
function dayExpr() {
  return sql<string>`to_char(timezone('${sql.raw(TIMEZONE)}', ${analyticsEvents.createdAt}), 'YYYY-MM-DD')`;
}

/** Retención: 90 días. Se ejecuta en ~1 de cada 100 ingestas. */
async function purgeOldEvents(): Promise<void> {
  try {
    await db.execute(
      sql`delete from ${analyticsEvents} where ${analyticsEvents.createdAt} < now() - interval '${sql.raw(String(RETENTION_DAYS))} days'`
    );
  } catch (error) {
    console.warn('[metrics] purge skipped:', (error as Error).message);
  }
}

/** Normaliza timestamps de neon-http (string) o Date a ISO 8601 UTC. */
function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return null;
}

/** Convierte agregados de Postgres (number o string) a número o null. */
function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** LCP/INP se redondean a milisegundos; CLS conserva 3 decimales. */
function roundVitalValue(metric: VitalMetric, value: number | null): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return metric === 'cls' ? Math.round(value * 1000) / 1000 : Math.round(value);
}

// ── POST /api/metrics/events ────────────────────────────────────────────────

// sendBeacon envía text/plain (request simple, sin preflight), así que se
// acepta además del JSON habitual.
router.post(
  '/events',
  express.text({ type: ['text/plain'], limit: '256kb' }),
  async (req, res) => {
    let body: unknown = req.body;

    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        res.status(400).json({ error: 'invalid-payload' });
        return;
      }
    }

    const rawEvents: unknown[] = Array.isArray(body)
      ? body
      : body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>)['events'])
        ? ((body as Record<string, unknown>)['events'] as unknown[])
        : body && typeof body === 'object'
          ? [body]
          : [];

    let rejected = 0;
    const accepted: CleanEvent[] = [];

    for (const raw of rawEvents.slice(0, MAX_BATCH)) {
      const clean = sanitizeEvent(raw);
      if (!clean) {
        rejected += 1;
        continue;
      }
      if (isRateLimited(clean.visitorId)) {
        rejected += 1;
        continue;
      }
      accepted.push(clean);
    }

    if (rawEvents.length > MAX_BATCH) rejected += rawEvents.length - MAX_BATCH;

    if (accepted.length === 0) {
      res.status(202).json({ accepted: 0, rejected });
      return;
    }

    try {
      await db.insert(analyticsEvents).values(
        accepted.map((event) => ({
          type: event.type,
          path: event.path,
          productId: event.productId,
          categoryId: event.categoryId,
          visitorId: event.visitorId,
          sessionId: event.sessionId,
          referrerHost: event.referrerHost,
          device: event.device,
          value: event.value,
          meta: event.meta,
        }))
      );

      if (Math.random() < 0.01) void purgeOldEvents();

      res.status(202).json({ accepted: accepted.length, rejected });
    } catch (error) {
      console.warn('[metrics] ingest failed:', (error as Error).message);
      res.status(503).json({ error: 'metrics-unavailable' });
    }
  }
);

// ── GET /api/metrics/summary ────────────────────────────────────────────────

router.get('/summary', async (req, res) => {
  const requested = Number(req.query['days'] ?? 7);
  const days = ALLOWED_RANGES.has(requested) ? requested : 7;

  const to = mexicoToday();
  const from = addDays(to, -(days - 1));
  const rangeWhere = sql`timezone('${sql.raw(TIMEZONE)}', ${analyticsEvents.createdAt})::date between ${from}::date and ${to}::date`;

  try {
    const typeRows = await db
      .select({ type: analyticsEvents.type, total: count() })
      .from(analyticsEvents)
      .where(rangeWhere)
      .groupBy(analyticsEvents.type);

    const byType = new Map<string, number>();
    for (const row of typeRows) byType.set(row.type, Number(row.total ?? 0));

    const [audience] = await db
      .select({
        visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})`.mapWith(Number),
        sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})`.mapWith(Number),
      })
      .from(analyticsEvents)
      .where(and(rangeWhere, eq(analyticsEvents.type, 'page_view')));

    const daily = await db
      .select({
        date: dayExpr(),
        pageViews: sql<number>`count(*) filter (where ${analyticsEvents.type} = 'page_view')`.mapWith(Number),
        visitors: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (where ${analyticsEvents.type} = 'page_view')`.mapWith(Number),
      })
      .from(analyticsEvents)
      .where(rangeWhere)
      .groupBy(dayExpr())
      .orderBy(dayExpr());

    const topPages = await db
      .select({ path: analyticsEvents.path, views: count() })
      .from(analyticsEvents)
      .where(and(rangeWhere, eq(analyticsEvents.type, 'page_view')))
      .groupBy(analyticsEvents.path)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const topProducts = await db
      .select({ productId: analyticsEvents.productId, views: count() })
      .from(analyticsEvents)
      .where(and(rangeWhere, eq(analyticsEvents.type, 'product_view'), isNotNull(analyticsEvents.productId)))
      .groupBy(analyticsEvents.productId)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const topCategories = await db
      .select({ categoryId: analyticsEvents.categoryId, views: count() })
      .from(analyticsEvents)
      .where(and(rangeWhere, eq(analyticsEvents.type, 'category_view'), isNotNull(analyticsEvents.categoryId)))
      .groupBy(analyticsEvents.categoryId)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const totals = {
      pageViews: byType.get('page_view') ?? 0,
      visitors: audience?.visitors ?? 0,
      sessions: audience?.sessions ?? 0,
      productViews: byType.get('product_view') ?? 0,
      categoryViews: byType.get('category_view') ?? 0,
      addToQuote: byType.get('add_to_quote') ?? 0,
      quoteOpens: byType.get('quote_open') ?? 0,
      pdfDownloads: byType.get('pdf_download') ?? 0,
      contactClicks: byType.get('contact_click') ?? 0,
      shippingCalcs: byType.get('shipping_calc') ?? 0,
      searches: byType.get('search') ?? 0,
      wishlistAdds: byType.get('wishlist_add') ?? 0,
    };

    res.json({
      range: { days, from, to, timezone: TIMEZONE },
      totals,
      daily,
      topPages,
      topProducts: topProducts.map((row) => ({ productId: row.productId, views: Number(row.views ?? 0) })),
      topCategories: topCategories.map((row) => ({ categoryId: row.categoryId, views: Number(row.views ?? 0) })),
      funnel: {
        productViews: totals.productViews,
        addToQuote: totals.addToQuote,
        quoteOpens: totals.quoteOpens,
        pdfDownloads: totals.pdfDownloads,
        contactClicks: totals.contactClicks,
      },
      events: typeRows.map((row) => ({ type: row.type, count: Number(row.total ?? 0) })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[metrics] summary failed:', (error as Error).message);
    res.status(503).json({ error: 'metrics-unavailable' });
  }
});

// ── GET /api/metrics/health ─────────────────────────────────────────────────

router.get('/health', async (_req, res) => {
  try {
    const [row] = await db
      .select({ lastEventAt: sql<string | null>`max(${analyticsEvents.createdAt})` })
      .from(analyticsEvents);

    res.json({ ok: true, lastEventAt: row?.lastEventAt ?? null });
  } catch (error) {
    console.warn('[metrics] health failed:', (error as Error).message);
    res.status(503).json({ ok: false, error: 'metrics-unavailable' });
  }
});

// ── GET /api/metrics/health-summary ─────────────────────────────────────────

router.get('/health-summary', async (req, res) => {
  const requested = Number(req.query['days'] ?? 7);
  const days = ALLOWED_RANGES.has(requested) ? requested : 7;

  const to = mexicoToday();
  const from = addDays(to, -(days - 1));
  const rangeWhere = sql`timezone('${sql.raw(TIMEZONE)}', ${analyticsEvents.createdAt})::date between ${from}::date and ${to}::date`;

  try {
    const [errorTotals] = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        unique: sql<number>`count(distinct ${analyticsEvents.meta}->>'message')`.mapWith(Number),
      })
      .from(analyticsEvents)
      .where(and(rangeWhere, eq(analyticsEvents.type, 'js_error')));

    // Se agrupa por mensaje crudo y se trunca en JS para no mezclar mensajes
    // distintos que solo comparten los primeros 200 caracteres.
    const topErrorRows = await db
      .select({
        message: sql<string | null>`${analyticsEvents.meta}->>'message'`,
        count: count(),
        lastPath: sql<string | null>`(array_agg(${analyticsEvents.path} order by ${analyticsEvents.createdAt} desc))[1]`,
        lastSeenAt: sql<string | null>`max(${analyticsEvents.createdAt})`,
      })
      .from(analyticsEvents)
      .where(and(rangeWhere, eq(analyticsEvents.type, 'js_error')))
      .groupBy(sql`${analyticsEvents.meta}->>'message'`)
      .orderBy(desc(sql`count(*)`), desc(sql`max(${analyticsEvents.createdAt})`))
      .limit(MAX_ERROR_GROUPS);

    const p75Expr = (metric: VitalMetric) =>
      sql<number | null>`percentile_cont(0.75) within group (order by ${analyticsEvents.value}) filter (where ${analyticsEvents.meta}->>'metric' = ${metric})`;
    const samplesExpr = (metric: VitalMetric) =>
      sql<number>`count(*) filter (where ${analyticsEvents.meta}->>'metric' = ${metric})`.mapWith(Number);

    const [vitalsRow] = await db
      .select({
        lcpP75: p75Expr('lcp'),
        lcpSamples: samplesExpr('lcp'),
        inpP75: p75Expr('inp'),
        inpSamples: samplesExpr('inp'),
        clsP75: p75Expr('cls'),
        clsSamples: samplesExpr('cls'),
      })
      .from(analyticsEvents)
      .where(and(rangeWhere, eq(analyticsEvents.type, 'web_vital'), isNotNull(analyticsEvents.value)));

    const vitals = {
      lcp: {
        p75: roundVitalValue('lcp', toNumberOrNull(vitalsRow?.lcpP75)),
        samples: Number(vitalsRow?.lcpSamples ?? 0),
      },
      inp: {
        p75: roundVitalValue('inp', toNumberOrNull(vitalsRow?.inpP75)),
        samples: Number(vitalsRow?.inpSamples ?? 0),
      },
      cls: {
        p75: roundVitalValue('cls', toNumberOrNull(vitalsRow?.clsP75)),
        samples: Number(vitalsRow?.clsSamples ?? 0),
      },
    };

    res.json({
      range: { days, from, to },
      errors: { total: errorTotals?.total ?? 0, unique: errorTotals?.unique ?? 0 },
      topErrors: topErrorRows.map((row) => ({
        message: (row.message ?? 'Error sin mensaje').slice(0, MAX_ERROR_MESSAGE_LENGTH),
        count: Number(row.count ?? 0),
        lastPath: row.lastPath ?? '/',
        lastSeenAt: toIso(row.lastSeenAt),
      })),
      vitals,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[metrics] health-summary failed:', (error as Error).message);
    res.status(503).json({ error: 'metrics-unavailable' });
  }
});

// ── POST /api/metrics/purge ─────────────────────────────────────────────────

router.post('/purge', async (_req, res) => {
  try {
    const deleted = await db
      .delete(analyticsEvents)
      .where(
        sql`${analyticsEvents.createdAt} < now() - interval '${sql.raw(String(RETENTION_DAYS))} days'`
      )
      .returning({ id: analyticsEvents.id });

    res.json({ deleted: deleted.length });
  } catch (error) {
    console.warn('[metrics] purge failed:', (error as Error).message);
    res.status(503).json({ error: 'metrics-unavailable' });
  }
});

// Nunca exponer stack traces: cualquier error de parseo del cuerpo termina aquí.
router.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.warn('[metrics] invalid request:', error?.message ?? 'unknown');
  res.status(400).json({ error: 'invalid-payload' });
});

export default router;
