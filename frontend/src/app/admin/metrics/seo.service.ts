import { Injectable } from '@angular/core';
import { ADMIN_API_BASE } from '../../core/services/admin-api.service';

/** Días por defecto del snapshot de Search Console (ventana de 28 días). */
export const SEO_DEFAULT_DAYS = 28;

/** Métricas de una fila de Search Console. `ctr` llega como fracción (0–1). */
export interface SeoMetric {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SeoDailyRow extends SeoMetric {
  date: string;
}

export interface SeoQueryRow extends SeoMetric {
  query: string;
}

export interface SeoPageRow extends SeoMetric {
  page: string;
}

export interface SeoDeviceRow extends SeoMetric {
  device: string;
}

/** Payload normalizado por `backend/src/services/search-console.service.ts`. */
export interface SeoSnapshot {
  version: number;
  siteUrl: string;
  range: {
    startDate: string;
    endDate: string;
    days: number;
    lagDays: number;
  };
  totals: SeoMetric;
  daily: SeoDailyRow[];
  queries: SeoQueryRow[];
  pages: SeoPageRow[];
  devices: SeoDeviceRow[];
  fetchedAt: string;
}

/** Respuesta de `GET /api/seo/summary` y `POST /api/seo/refresh`. */
export interface SeoSummaryResponse {
  connected: boolean;
  stale?: boolean;
  fetchedAt?: string;
  siteUrl?: string;
  snapshot?: SeoSnapshot;
  /** `missing-credentials` | `no-data` | `disabled` | `error` | `timeout`. */
  reason?: string;
  message?: string;
  lastAttemptAt?: string | null;
  lastError?: string | null;
}

/** Respuesta de `GET /api/seo/status`. */
export interface SeoStatus {
  connected: boolean;
  hasCredentials: boolean;
  siteUrl: string;
  disabled: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  snapshotAt: string | null;
  stale: boolean;
}

/** Error de dominio: el componente solo muestra `message`. */
export class SeoApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'SeoApiError';
  }
}

const SUMMARY_TIMEOUT_MS = 15_000;
/** El backend se autolimita a 20 s; se deja margen para la red. */
const REFRESH_TIMEOUT_MS = 30_000;

/**
 * SeoService — lectura y refresco de los datos de Google Search Console.
 *
 * Reutiliza `ADMIN_API_BASE` para no duplicar la URL de la API. Los errores se
 * normalizan a `SeoApiError` para que el panel muestre un estado recuperable.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  async getStatus(): Promise<SeoStatus> {
    return this.request<SeoStatus>('/seo/status', 'GET', SUMMARY_TIMEOUT_MS);
  }

  async getSummary(days: number = SEO_DEFAULT_DAYS): Promise<SeoSummaryResponse> {
    return this.request<SeoSummaryResponse>(
      `/seo/summary?days=${days}`,
      'GET',
      SUMMARY_TIMEOUT_MS
    );
  }

  async refresh(days: number = SEO_DEFAULT_DAYS): Promise<SeoSummaryResponse> {
    return this.request<SeoSummaryResponse>(`/seo/refresh?days=${days}`, 'POST', REFRESH_TIMEOUT_MS);
  }

  private async request<T>(path: string, method: 'GET' | 'POST', timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${ADMIN_API_BASE}${path}`, {
        method,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new SeoApiError(
          response.status === 503
            ? 'El backend no tiene base de datos disponible (503).'
            : `La API de SEO respondió con un error ${response.status}.`,
          response.status
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SeoApiError) throw error;
      if (isAbortError(error)) {
        throw new SeoApiError(
          `La API tardó más de ${Math.round(timeoutMs / 1000)} segundos en responder.`
        );
      }
      throw new SeoApiError('No se pudo conectar con la API de SEO.');
    } finally {
      clearTimeout(timer);
    }
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}
