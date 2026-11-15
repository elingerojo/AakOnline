import { Component, computed, inject, signal, type OnInit } from '@angular/core';
import { AdminNavComponent } from '../admin-nav/admin-nav.component';
import {
  METRICS_RANGES,
  MetricsService,
  type MetricsDays,
  type MetricsSummary,
} from './metrics.service';

const TIMEZONE = 'America/Mexico_City';

/**
 * Panel `/admin/metrics`: tráfico y comportamiento del catálogo a partir del
 * resumen del Corte 2. Sin librerías de gráficas: SVG/CSS y contenedores.
 */
@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [AdminNavComponent],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">Admin - Métricas</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">Tráfico y comportamiento del catálogo</p>
          </div>
          <app-admin-nav />
        </div>
      </header>

      <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <!-- Filtro de periodo + nota de zona horaria -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
               role="group" aria-label="Periodo de las métricas">
            @for (range of ranges; track range) {
              <button type="button" (click)="selectDays(range)"
                      [attr.aria-label]="'Ver métricas de los últimos ' + range + ' días'"
                      [attr.aria-pressed]="days() === range"
                      [class]="filterClass(range)">
                {{ range }} días
              </button>
            }
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Zona horaria <span class="font-medium text-gray-700 dark:text-gray-200">America/Mexico_City</span>
            @if (summary(); as s) {
              · {{ s.range.from }} → {{ s.range.to }}
              · generado {{ generatedLabel() }}
            }
          </p>
        </div>

        @if (loading()) {
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
               role="status" aria-live="polite">
            <p class="text-sm text-gray-500 dark:text-gray-400">Cargando métricas…</p>
            <div class="mt-4 space-y-3">
              <div class="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
              <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
              <div class="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
            </div>
          </div>
        } @else if (error()) {
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-6">
            <h2 class="text-sm font-semibold text-red-700 dark:text-red-300">No se pudieron cargar las métricas</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ error() }}</p>
            <button type="button" (click)="retry()"
                    class="mt-4 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 cursor-pointer">
              Reintentar
            </button>
          </div>
        } @else if (isEmpty()) {
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">Aún no hay datos en este periodo.</p>
            <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Navega la tienda y vuelve a abrir este panel: los eventos se agrupan cada 10 segundos.
            </p>
          </div>
        } @else if (summary(); as s) {
          <!-- Secciones de contenido (KPIs, tendencia, tops y embudo) -->
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Periodo de {{ s.range.days }} días.
          </p>
        }
      </div>
    </div>
  `,
})
export class MetricsComponent implements OnInit {
  private readonly metricsService = inject(MetricsService);

  protected readonly ranges = METRICS_RANGES;
  protected readonly days = signal<MetricsDays>(7);
  protected readonly summary = signal<MetricsSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  private loadToken = 0;

  ngOnInit(): void {
    void this.load();
  }

  protected selectDays(days: MetricsDays): void {
    if (this.days() === days) return;
    this.days.set(days);
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected readonly isEmpty = computed(() => {
    const summary = this.summary();
    if (!summary) return false;
    return (
      summary.totals.pageViews === 0 &&
      summary.totals.productViews === 0 &&
      summary.totals.categoryViews === 0
    );
  });

  protected filterClass(range: MetricsDays): string {
    const base = 'px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ';
    return this.days() === range
      ? `${base}bg-amber-600 text-white`
      : `${base}bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-gray-700`;
  }

  protected generatedLabel(): string {
    const summary = this.summary();
    if (!summary) return '—';
    try {
      const date = new Date(summary.generatedAt);
      if (Number.isNaN(date.getTime())) return summary.generatedAt;
      return new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: TIMEZONE,
      }).format(date);
    } catch {
      return summary.generatedAt;
    }
  }

  protected formatNumber(value: number | null | undefined): string {
    return Number(value ?? 0).toLocaleString('es-MX');
  }

  private async load(): Promise<void> {
    const token = ++this.loadToken;
    this.loading.set(true);
    this.error.set('');

    try {
      const summary = await this.metricsService.getSummary(this.days());
      if (token !== this.loadToken) return;
      this.summary.set(summary);
    } catch (error) {
      if (token !== this.loadToken) return;
      this.summary.set(null);
      this.error.set(
        error instanceof Error && error.message
          ? error.message
          : 'Error desconocido al consultar la API de métricas.'
      );
    } finally {
      if (token === this.loadToken) this.loading.set(false);
    }
  }
}
