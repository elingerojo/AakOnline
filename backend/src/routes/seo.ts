/**
 * seo.ts — Datos de Google Search Console cacheados en Neon.
 *
 *   GET  /api/seo/status           → estado de la integración
 *   GET  /api/seo/summary?days=28  → último snapshot (con refresco en background)
 *   POST /api/seo/refresh          → refresco en línea (máx. 20 s)
 *
 * Reglas:
 * - Nunca se responde 500 por falta de configuración: siempre 200 con
 *   `connected: false` y un `reason` explícito.
 * - Las credenciales y los tokens jamás salen en la respuesta ni en los logs.
 */

import { Router } from 'express';
import { and, desc, eq, lt } from 'drizzle-orm';

import { db } from '../db/index.js';
import { seoSnapshots, seoSyncState } from '../schema/index.js';
import {
  DEFAULT_SEO_DAYS,
  SeoCredentialsError,
  fetchSeoSnapshot,
  getSeoConfig,
  sanitizeSeoError,
  type SeoSnapshot,
} from '../services/search-console.service.js';

const router = Router();

const STALE_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_BUDGET_MS = 20_000;

const MISSING_CREDENTIALS_MESSAGE =
  'Falta la variable SEARCH_CONSOLE_SA_JSON en el backend (JSON de la service account, crudo o en base64).';
const DISABLED_MESSAGE = 'La integración está desactivada con SEARCH_CONSOLE_DISABLED=1.';
const NO_DATA_MESSAGE =
  'Todavía no hay snapshot guardado. Google publica los datos con 2–3 días de retraso; el primer refresco tarda unos segundos.';

interface RefreshOutcome {
  ok: boolean;
  snapshot?: SeoSnapshot;
  reason?: 'disabled' | 'missing-credentials' | 'error' | 'timeout';
  message?: string;
}

let refreshInFlight: Promise<RefreshOutcome> | null = null;

// ── Helpers de almacenamiento ───────────────────────────────────────────────

function parseDays(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_SEO_DAYS);
  if (!Number.isFinite(parsed)) return DEFAULT_SEO_DAYS;
  const days = Math.trunc(parsed);
  return days >= 7 && days <= 90 ? days : DEFAULT_SEO_DAYS;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function upsertSyncState(values: {
  lastAttemptAt?: Date;
  lastSuccessAt?: Date;
  lastError?: string | null;
}): Promise<void> {
  try {
    await db
      .insert(seoSyncState)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: seoSyncState.id, set: values });
  } catch (error) {
    console.warn('[seo] no se pudo guardar el estado de sincronización:', sanitizeSeoError(error));
  }
}

async function readSyncState() {
  try {
    const [row] = await db.select().from(seoSyncState).where(eq(seoSyncState.id, 1)).limit(1);
    return row ?? null;
  } catch (error) {
    console.warn('[seo] no se pudo leer el estado de sincronización:', sanitizeSeoError(error));
    return null;
  }
}

async function readLatestSnapshot(siteUrl: string, days: number) {
  try {
    const [row] = await db
      .select({
        id: seoSnapshots.id,
        days: seoSnapshots.days,
        payload: seoSnapshots.payload,
        fetchedAt: seoSnapshots.fetchedAt,
      })
      .from(seoSnapshots)
      .where(and(eq(seoSnapshots.siteUrl, siteUrl), eq(seoSnapshots.days, days)))
      .orderBy(desc(seoSnapshots.fetchedAt))
      .limit(1);
    return row ?? null;
  } catch (error) {
    console.warn('[seo] no se pudo leer el snapshot:', sanitizeSeoError(error));
    return null;
  }
}

/** Retención: 30 días de snapshots (el panel sólo usa el más reciente). */
async function pruneSnapshots(): Promise<void> {
  try {
    await db
      .delete(seoSnapshots)
      .where(lt(seoSnapshots.fetchedAt, new Date(Date.now() - RETENTION_MS)));
  } catch (error) {
    console.warn('[seo] no se pudieron purgar snapshots:', sanitizeSeoError(error));
  }
}

// ── Refresco ────────────────────────────────────────────────────────────────

async function performRefresh(days: number): Promise<RefreshOutcome> {
  const config = getSeoConfig();

  if (config.disabled) {
    return { ok: false, reason: 'disabled', message: DISABLED_MESSAGE };
  }

  if (!config.hasCredentials) {
    await upsertSyncState({ lastAttemptAt: new Date(), lastError: 'missing-credentials' });
    return { ok: false, reason: 'missing-credentials', message: MISSING_CREDENTIALS_MESSAGE };
  }

  await upsertSyncState({ lastAttemptAt: new Date() });

  try {
    const snapshot = await fetchSeoSnapshot(days);

    await db.insert(seoSnapshots).values({
      siteUrl: snapshot.siteUrl,
      days: snapshot.range.days,
      version: snapshot.version,
      payload: snapshot,
    });

    await upsertSyncState({
      lastAttemptAt: new Date(),
      lastSuccessAt: new Date(),
      lastError: null,
    });
    await pruneSnapshots();

    return { ok: true, snapshot };
  } catch (error) {
    if (error instanceof SeoCredentialsError) {
      await upsertSyncState({ lastAttemptAt: new Date(), lastError: 'missing-credentials' });
      return { ok: false, reason: 'missing-credentials', message: MISSING_CREDENTIALS_MESSAGE };
    }

    const message = sanitizeSeoError(error);
    await upsertSyncState({ lastAttemptAt: new Date(), lastError: message });
    return { ok: false, reason: 'error', message };
  }
}

/** Deduplica refrescos concurrentes (botón + refresco en background). */
function refreshNow(days: number): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;

  const task = performRefresh(days).catch(
    (error): RefreshOutcome => ({ ok: false, reason: 'error', message: sanitizeSeoError(error) })
  );

  const tracked = task.finally(() => {
    refreshInFlight = null;
  });

  refreshInFlight = tracked;
  return tracked;
}

function startBackgroundRefresh(days: number): void {
  void refreshNow(days);
}

function withBudget(task: Promise<RefreshOutcome>, budgetMs: number): Promise<RefreshOutcome> {
  return new Promise<RefreshOutcome>((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        ok: false,
        reason: 'timeout',
        message: `Google tardó más de ${Math.round(budgetMs / 1000)} s en responder; el refresco continúa en segundo plano.`,
      });
    }, budgetMs);

    task
      .then((outcome) => resolve(outcome))
      .catch((error) =>
        resolve({ ok: false, reason: 'error', message: sanitizeSeoError(error) })
      )
      .finally(() => clearTimeout(timer));
  });
}

// ── GET /api/seo/status ─────────────────────────────────────────────────────

router.get('/status', async (_req, res) => {
  const config = getSeoConfig();
  const state = await readSyncState();
  const latest = await readLatestSnapshot(config.siteUrl, DEFAULT_SEO_DAYS);

  const lastAttemptAt = toIso(state?.lastAttemptAt);
  const lastSuccessAt = toIso(state?.lastSuccessAt);
  const snapshotAt = toIso(latest?.fetchedAt);
  const reference = lastSuccessAt ?? snapshotAt;
  const stale = !reference || Date.now() - new Date(reference).getTime() > STALE_MS;

  res.json({
    connected: config.hasCredentials && Boolean(reference),
    hasCredentials: config.hasCredentials,
    siteUrl: config.siteUrl,
    disabled: config.disabled,
    lastAttemptAt,
    lastSuccessAt,
    lastError: state?.lastError ?? null,
    snapshotAt,
    stale,
  });
});

// ── GET /api/seo/summary ────────────────────────────────────────────────────

router.get('/summary', async (req, res) => {
  const days = parseDays(req.query['days']);
  const config = getSeoConfig();
  const latest = await readLatestSnapshot(config.siteUrl, days);

  if (latest) {
    const fetchedAt = toIso(latest.fetchedAt) ?? new Date().toISOString();
    const stale = Date.now() - new Date(fetchedAt).getTime() > STALE_MS;

    if (stale && !config.disabled && config.hasCredentials) startBackgroundRefresh(days);

    res.json({
      connected: true,
      stale,
      fetchedAt,
      siteUrl: config.siteUrl,
      snapshot: latest.payload as SeoSnapshot,
    });
    return;
  }

  if (config.disabled) {
    res.json({ connected: false, reason: 'disabled', message: DISABLED_MESSAGE });
    return;
  }

  if (!config.hasCredentials) {
    const state = await readSyncState();
    res.json({
      connected: false,
      reason: 'missing-credentials',
      message: MISSING_CREDENTIALS_MESSAGE,
      lastAttemptAt: toIso(state?.lastAttemptAt),
      lastError: state?.lastError ?? null,
    });
    return;
  }

  startBackgroundRefresh(days);
  const state = await readSyncState();
  res.json({
    connected: false,
    reason: 'no-data',
    message: NO_DATA_MESSAGE,
    lastAttemptAt: toIso(state?.lastAttemptAt),
    lastError: state?.lastError ?? null,
  });
});

// ── POST /api/seo/refresh ───────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const days = parseDays(body['days'] ?? req.query['days']);

  const outcome = await withBudget(refreshNow(days), REFRESH_BUDGET_MS);

  if (outcome.ok && outcome.snapshot) {
    res.json({
      connected: true,
      stale: false,
      fetchedAt: outcome.snapshot.fetchedAt,
      siteUrl: outcome.snapshot.siteUrl,
      snapshot: outcome.snapshot,
    });
    return;
  }

  res.json({
    connected: false,
    reason: outcome.reason ?? 'error',
    message: outcome.message ?? 'No se pudo actualizar Search Console.',
  });
});

export default router;
