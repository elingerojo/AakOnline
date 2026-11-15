import { Component, computed, inject, signal, type OnInit } from '@angular/core';
import {
  MetricsService,
  type MetricsHealthSummary,
  type MetricsVitalSummary,
} from './metrics.service';

const TIMEZONE = 'America/Mexico_City';
const HEALTH_DAYS = 7;

type VitalRating = 'good' | 'warn' | 'bad' | 'none';
type VitalKey = 'lcp' | 'inp' | 'cls';

interface KpiCard {
  label: string;
  value: string;
  hint: string;
}

interface VitalCard {
  key: VitalKey;
  label: string;
  name: string;
  value: string;
  samples: number;
  rating: VitalRating;
  ratingLabel: string;
  threshold: string;
}

/**
 * Pestaña "Salud" de `/admin/metrics`: errores JS no capturados y Core Web
 * Vitals reales (p75) desde `GET /api/metrics/health-summary`, más la purga
 * manual de la retención de 90 días. Sin dependencias de gráficas.
 */
@Component({
  selector: 'app-health-panel',
  standalone: true,
  template: `
    @if (loading()) {
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
           role="status" aria-live="polite">
        <p class="text-sm text-gray-500 dark:text-gray-400">Consultando salud del sitio…</p>
        <div class="mt-4 space-y-3">
          <div class="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
          <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
          <div class="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        </div>
      </div>
    } @else if (error()) {
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-6">
        <h2 class="text-sm font-semibold text-red-700 dark:text-red-300">No se pudo consultar la salud del sitio</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ error() }}</p>
        <button type="button" (click)="reload()"
                class="mt-4 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 cursor-pointer">
          Reintentar
        </button>
      </div>
    } @else if (summary(); as s) {
      <!-- Cabecera: periodo, generación y purga manual -->
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Últimos {{ s.range.days }} días · {{ s.range.from }} → {{ s.range.to }}
            · generado {{ generatedLabel() }}
          </p>
          <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Errores JS no capturados y Core Web Vitals reales (p75) enviados por los navegadores.
          </p>
        </div>
        <button type="button" (click)="purge()" [disabled]="purging()"
                aria-label="Purgar eventos con más de 90 días"
                class="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 dark:border-red-700
                       text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20
                       disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors">
          {{ purging() ? 'Purgando…' : 'Purgar datos de más de 90 días' }}
        </button>
      </div>

      @if (purgeMessage()) {
        <p class="text-sm" aria-live="polite"
           [class]="purgeError() ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'">
          {{ purgeMessage() }}
        </p>
      }

      <!-- KPIs -->
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Indicadores de salud">
        @for (card of kpis(); track card.label) {
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ card.label }}</p>
            <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white break-words">{{ card.value }}</p>
            @if (card.hint) {
              <p class="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate" [attr.title]="card.hint">{{ card.hint }}</p>
            }
          </div>
        }
      </section>

      <!-- Core Web Vitals -->
      <section aria-labelledby="vitals-title">
        <div class="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 id="vitals-title" class="text-sm font-semibold text-gray-900 dark:text-white">Core Web Vitals (p75)</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">Umbrales de Google · CLS mostrado en escala ×100</p>
        </div>

        <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          @for (card of vitalCards(); track card.key) {
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ card.label }}</p>
                <span [class]="ratingClass(card.rating)">{{ card.ratingLabel }}</span>
              </div>
              <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{{ card.value }}</p>
              <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {{ card.samples }} {{ card.samples === 1 ? 'muestra' : 'muestras' }}
              </p>
              <p class="mt-2 text-xs text-gray-400 dark:text-gray-500">{{ card.name }}</p>
              <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ card.threshold }}</p>
            </div>
          }
        </div>
      </section>

      <!-- Top errores -->
      <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Errores JavaScript más frecuentes</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">Máximo 10 mensajes · ruta y último avistamiento</p>
        </div>

        <ol class="mt-3 space-y-3">
          @for (item of s.topErrors; track item.message; let i = $index) {
            <li class="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0 last:pb-0">
              <div class="min-w-0">
                <p class="text-sm text-gray-800 dark:text-gray-100 break-words">
                  <span class="text-gray-400 dark:text-gray-500 mr-1.5">{{ i + 1 }}.</span>{{ item.message }}
                </p>
                <p class="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate"
                   [attr.title]="item.lastPath + ' · ' + formatDate(item.lastSeenAt)">
                  {{ item.lastPath }} · {{ formatDate(item.lastSeenAt) }}
                </p>
              </div>
              <span class="shrink-0 inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40
                           px-2 py-0.5 text-xs font-medium text-red-800 dark:text-red-300 tabular-nums">
                {{ formatNumber(item.count) }}
              </span>
            </li>
          } @empty {
            <li class="text-sm text-gray-400 dark:text-gray-500">
              Sin errores JavaScript en los últimos {{ s.range.days }} días.
            </li>
          }
        </ol>
      </section>

      <!-- Privacidad y retención -->
      <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Privacidad y retención</h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Sin cookies de terceros, sin IP y sin datos personales. El único identificador es un UUID anónimo
          guardado en el navegador y respetamos Do Not Track. Los eventos se conservan 90 días: la purga
          automática corre durante la ingesta y este botón la ejecuta manualmente.
        </p>
      </section>
    }
  `,
})
export class HealthPanelComponent implements OnInit {
  private readonly metricsService = inject(MetricsService);

  protected readonly days = HEALTH_DAYS;
  protected readonly summary = signal<MetricsHealthSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly purging = signal(false);
  protected readonly purgeMessage = signal('');
  protected readonly purgeError = signal(false);

  ngOnInit(): void {
    void this.load();
  }

  protected readonly vitalSamples = computed(() => {
    const vitals = this.summary()?.vitals;
    if (!vitals) return 0;
    return vitals.lcp.samples + vitals.inp.samples + vitals.cls.samples;
  });

  protected readonly kpis = computed<KpiCard[]>(() => {
    const summary = this.summary();
    if (!summary) return [];
    return [
      {
        label: 'Errores JS',
        value: this.formatNumber(summary.errors.total),
        hint: 'Eventos js_error en el periodo',
      },
      {
        label: 'Errores únicos',
        value: this.formatNumber(summary.errors.unique),
        hint: 'Mensajes distintos (no repetidos)',
      },
      {
        label: 'Muestras de vitals',
        value: this.formatNumber(this.vitalSamples()),
        hint: 'Eventos LCP + INP + CLS recibidos',
      },
    ];
  });

  protected readonly vitalCards = computed<VitalCard[]>(() => {
    const vitals = this.summary()?.vitals;
    if (!vitals) return [];
    return [
      this.vitalCard('lcp', 'LCP', 'Largest Contentful Paint', vitals.lcp, 2500, 4000, 'ms'),
      this.vitalCard('inp', 'INP', 'Interaction to Next Paint', vitals.inp, 200, 500, 'ms'),
      this.vitalCard('cls', 'CLS ×100', 'Cumulative Layout Shift', vitals.cls, 0.1, 0.25, ''),
    ];
  });

  protected reload(): void {
    void this.load();
  }

  protected ratingClass(rating: VitalRating): string {
    const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ';
    switch (rating) {
      case 'good':
        return `${base}bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300`;
      case 'warn':
        return `${base}bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`;
      case 'bad':
        return `${base}bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300`;
      default:
        return `${base}bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300`;
    }
  }

  protected formatNumber(value: number | null | undefined): string {
    return Number(value ?? 0).toLocaleString('es-MX');
  }

  protected formatDate(iso: string | null): string {
    if (!iso) return 'sin fecha';
    try {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return iso;
      return new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: TIMEZONE,
      }).format(date);
    } catch {
      return iso;
    }
  }

  protected generatedLabel(): string {
    const summary = this.summary();
    if (!summary) return '—';
    return this.formatDate(summary.generatedAt);
  }

  /** Purga manual de eventos fuera de la retención de 90 días. */
  protected async purge(): Promise<void> {
    try {
      const confirmed =
        typeof confirm === 'function' &&
        confirm(
          'Se eliminarán permanentemente los eventos con más de 90 días. Los datos recientes no se tocan. ¿Continuar?'
        );
      if (!confirmed) return;
    } catch {
      return;
    }

    this.purging.set(true);
    this.purgeMessage.set('');
    this.purgeError.set(false);

    try {
      const result = await this.metricsService.purge();
      this.purgeMessage.set(
        result.deleted === 0
          ? 'No había eventos con más de 90 días.'
          : `Se eliminaron ${this.formatNumber(result.deleted)} eventos con más de 90 días.`
      );
      await this.load();
    } catch (error) {
      this.purgeError.set(true);
      this.purgeMessage.set(
        error instanceof Error && error.message ? error.message : 'No se pudo purgar la base de datos.'
      );
    } finally {
      this.purging.set(false);
    }
  }

  private vitalCard(
    key: VitalKey,
    label: string,
    name: string,
    data: MetricsVitalSummary,
    goodMax: number,
    poorMax: number,
    unit: string
  ): VitalCard {
    const hasSamples = data.samples > 0;
    const value = !hasSamples
      ? '—'
      : key === 'cls'
        ? (data.p75 * 100).toFixed(1)
        : `${Math.round(data.p75)} ${unit}`;

    const rating: VitalRating = !hasSamples
      ? 'none'
      : data.p75 <= goodMax
        ? 'good'
        : data.p75 <= poorMax
          ? 'warn'
          : 'bad';

    const ratingLabel =
      rating === 'good'
        ? 'Bueno'
        : rating === 'warn'
          ? 'Mejorable'
          : rating === 'bad'
            ? 'Pobre'
            : 'Sin muestras';

    const threshold =
      key === 'cls'
        ? 'Bueno ≤ 10 · pobre > 25 (escala ×100)'
        : `Bueno ≤ ${goodMax} ${unit} · pobre > ${poorMax} ${unit}`;

    return { key, label, name, value, samples: data.samples, rating, ratingLabel, threshold };
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const summary = await this.metricsService.getHealthSummary(this.days);
      this.summary.set(summary);
    } catch (error) {
      this.summary.set(null);
      this.error.set(
        error instanceof Error && error.message
          ? error.message
          : 'Error desconocido al consultar la salud del sitio.'
      );
    } finally {
      this.loading.set(false);
    }
  }
}
