import { Injectable } from '@angular/core';
import { ADMIN_API_BASE } from '../../core/services/admin-api.service';

/** Periodos permitidos por `GET /api/metrics/summary`. */
export const METRICS_RANGES = [7, 30, 90] as const;
export type MetricsDays = (typeof METRICS_RANGES)[number];

/** Contrato de `GET /api/metrics/summary` (ver Corte 2). */
export interface MetricsSummary {
  range: {
    days: number;
    from: string;
    to: string;
    timezone: string;
  };
  totals: MetricsTotals;
  daily: MetricsDailyPoint[];
  topPages: MetricsTopPage[];
  topProducts: MetricsTopProduct[];
  topCategories: MetricsTopCategory[];
  funnel: MetricsFunnel;
  events: MetricsEventCount[];
  generatedAt: string;
}

export interface MetricsTotals {
  pageViews: number;
  visitors: number;
  sessions: number;
  productViews: number;
  categoryViews: number;
  addToQuote: number;
  quoteOpens: number;
  pdfDownloads: number;
  contactClicks: number;
  shippingCalcs: number;
  searches: number;
  wishlistAdds: number;
}

export interface MetricsDailyPoint {
  date: string;
  pageViews: number;
  visitors: number;
}

export interface MetricsTopPage {
  path: string;
  views: number;
}

export interface MetricsTopProduct {
  productId: number;
  views: number;
}

export interface MetricsTopCategory {
  categoryId: number;
  views: number;
}

export interface MetricsFunnel {
  productViews: number;
  addToQuote: number;
  quoteOpens: number;
  pdfDownloads: number;
  contactClicks: number;
}

export interface MetricsEventCount {
  type: string;
  count: number;
}

/** Grupo de errores JS agrupado por mensaje (Corte 5). */
export interface MetricsHealthErrorGroup {
  message: string;
  count: number;
  lastPath: string;
  lastSeenAt: string | null;
}

/** p75 y número de muestras de un Core Web Vital. CLS en escala 0–1. */
export interface MetricsVitalSummary {
  p75: number;
  samples: number;
}

/** Contrato de `GET /api/metrics/health-summary`. */
export interface MetricsHealthSummary {
  range: {
    days: number;
    from: string;
    to: string;
  };
  errors: {
    total: number;
    unique: number;
  };
  topErrors: MetricsHealthErrorGroup[];
  vitals: {
    lcp: MetricsVitalSummary;
    inp: MetricsVitalSummary;
    cls: MetricsVitalSummary;
  };
  generatedAt: string;
}

/** Respuesta de `POST /api/metrics/purge`. */
export interface MetricsPurgeResult {
  deleted: number;
}

/** Error de dominio: el componente solo muestra `message`. */
export class MetricsApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'MetricsApiError';
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * MetricsService — lectura del resumen de métricas propias.
 *
 * Timeout explícito de 15 s y error tipado para que la UI pueda mostrar un
 * estado de error con "Reintentar" en lugar de quedarse cargando.
 */
@Injectable({ providedIn: 'root' })
export class MetricsService {
  async getSummary(days: MetricsDays = 7): Promise<MetricsSummary> {
    return this.request<MetricsSummary>(`/metrics/summary?days=${days}`, 'GET');
  }

  /** Errores JS y Core Web Vitals reales (p75) de los últimos días. */
  async getHealthSummary(days: MetricsDays = 7): Promise<MetricsHealthSummary> {
    return this.request<MetricsHealthSummary>(`/metrics/health-summary?days=${days}`, 'GET');
  }

  /**
   * Borra eventos con más de 90 días de antigüedad.
   * La retención la decide el backend; este método no recibe fecha.
   */
  async purge(): Promise<MetricsPurgeResult> {
    return this.request<MetricsPurgeResult>('/metrics/purge', 'POST');
  }

  private async request<T>(path: string, method: 'GET' | 'POST'): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${ADMIN_API_BASE}${path}`, {
        method,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new MetricsApiError(
          response.status === 503
            ? 'El servicio de métricas no está disponible en este momento (503).'
            : `La API respondió con un error ${response.status}.`,
          response.status
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof MetricsApiError) throw error;
      if (isAbortError(error)) {
        throw new MetricsApiError('La API tardó más de 15 segundos en responder.');
      }
      throw new MetricsApiError('No se pudo conectar con la API de métricas.');
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
