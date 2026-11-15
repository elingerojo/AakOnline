import { Component, computed, inject, signal, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminNavComponent } from '../admin-nav/admin-nav.component';
import { CategoryService } from '../../core/services/category.service';
import { ProductService } from '../../core/services/product.service';
import {
  METRICS_RANGES,
  MetricsService,
  type MetricsDailyPoint,
  type MetricsDays,
  type MetricsSummary,
} from './metrics.service';
import { SeoPanelComponent } from './seo-panel.component';

type MetricsTab = 'trafico' | 'seo';

const TIMEZONE = 'America/Mexico_City';

/** Suma un día a una fecha `YYYY-MM-DD` sin desfase de zona horaria. */
function nextDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

interface KpiCard {
  label: string;
  value: string;
  hint: string;
}

interface FunnelStep {
  label: string;
  value: number;
  hint: string;
  /** Porcentaje sobre la base del embudo; `null` si no hubo vistas de producto. */
  percent: number | null;
}

/**
 * Panel `/admin/metrics`: tráfico y comportamiento del catálogo a partir del
 * resumen del Corte 2. Sin librerías de gráficas: SVG/CSS y contenedores.
 */
@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [RouterLink, AdminNavComponent, SeoPanelComponent],
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

        <!-- Pestañas: tráfico propio y SEO de Google Search Console -->
        <div class="max-w-7xl mx-auto px-4">
          <div class="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700"
               role="tablist" aria-label="Secciones de métricas">
            <button type="button" role="tab" (click)="selectTab('trafico')"
                    [attr.aria-selected]="tab() === 'trafico'" [class]="tabClass('trafico')">
              Tráfico
            </button>
            <button type="button" role="tab" (click)="selectTab('seo')"
                    [attr.aria-selected]="tab() === 'seo'" [class]="tabClass('seo')">
              SEO
            </button>
          </div>
        </div>
      </header>

      <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
        @if (tab() === 'seo') {
          <app-seo-panel />
        } @else {
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
          <div class="flex items-center gap-3 flex-wrap">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Zona horaria <span class="font-medium text-gray-700 dark:text-gray-200">America/Mexico_City</span>
              @if (summary(); as s) {
                · {{ s.range.from }} → {{ s.range.to }}
                · generado {{ generatedLabel() }}
              }
            </p>
            @if (summary()) {
              <button type="button" (click)="exportCsv()" [disabled]="loading()"
                      aria-label="Descargar métricas del periodo en CSV"
                      class="px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-600 text-amber-700
                             dark:text-amber-300 dark:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20
                             disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors">
                Descargar CSV
              </button>
            }
          </div>
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
          <!-- KPIs -->
          <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Indicadores principales">
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

          <!-- Tendencia diaria -->
          <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div class="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Tendencia diaria</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">Altura: visitas · pasa el cursor para ver el detalle</p>
            </div>

            @if (trend().length > 0) {
              <div class="mt-4 flex items-end gap-px h-40 overflow-hidden" role="img"
                   [attr.aria-label]="'Visitas por día del ' + s.range.from + ' al ' + s.range.to">
                @for (day of trend(); track day.date) {
                  <div class="flex-1 min-w-0 h-full flex items-end">
                    <div class="w-full rounded-t bg-amber-500 dark:bg-amber-400"
                         [style.height.%]="barHeight(day.pageViews)"
                         [attr.title]="dayTitle(day)"></div>
                  </div>
                }
              </div>
              <div class="mt-2 flex justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>{{ dayLabel(s.range.from) }}</span>
                <span>{{ dayLabel(s.range.to) }}</span>
              </div>
            } @else {
              <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">Sin visitas registradas en este periodo.</p>
            }
          </section>

          <!-- Tops -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Top 10 páginas</h2>
              <ol class="mt-3 space-y-2">
                @for (page of s.topPages; track page.path; let i = $index) {
                  <li class="flex items-center justify-between gap-3 text-sm">
                    <span class="truncate text-gray-700 dark:text-gray-200" [attr.title]="page.path">
                      <span class="text-gray-400 dark:text-gray-500 mr-1.5">{{ i + 1 }}.</span>{{ page.path }}
                    </span>
                    <span class="font-medium text-gray-900 dark:text-white tabular-nums">{{ formatNumber(page.views) }}</span>
                  </li>
                } @empty {
                  <li class="text-sm text-gray-400 dark:text-gray-500">Sin datos.</li>
                }
              </ol>
            </section>

            <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Top 10 productos</h2>
              <ol class="mt-3 space-y-2">
                @for (product of s.topProducts; track product.productId; let i = $index) {
                  <li class="flex items-center justify-between gap-3 text-sm">
                    <span class="truncate text-gray-700 dark:text-gray-200">
                      <span class="text-gray-400 dark:text-gray-500 mr-1.5">{{ i + 1 }}.</span>
                      @if (productLink(product.productId); as link) {
                        <a [routerLink]="link"
                           class="hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                           [attr.title]="productName(product.productId)">{{ productName(product.productId) }}</a>
                      } @else {
                        {{ productName(product.productId) }}
                      }
                    </span>
                    <span class="font-medium text-gray-900 dark:text-white tabular-nums">{{ formatNumber(product.views) }}</span>
                  </li>
                } @empty {
                  <li class="text-sm text-gray-400 dark:text-gray-500">Sin datos.</li>
                }
              </ol>
            </section>

            <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Top 10 categorías</h2>
              <ol class="mt-3 space-y-2">
                @for (category of s.topCategories; track category.categoryId; let i = $index) {
                  <li class="flex items-center justify-between gap-3 text-sm">
                    <span class="truncate text-gray-700 dark:text-gray-200" [attr.title]="categoryName(category.categoryId)">
                      <span class="text-gray-400 dark:text-gray-500 mr-1.5">{{ i + 1 }}.</span>{{ categoryName(category.categoryId) }}
                    </span>
                    <span class="font-medium text-gray-900 dark:text-white tabular-nums">{{ formatNumber(category.views) }}</span>
                  </li>
                } @empty {
                  <li class="text-sm text-gray-400 dark:text-gray-500">Sin datos.</li>
                }
              </ol>
            </section>
          </div>

          <!-- Embudo de interacción -->
          <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div class="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Embudo de interacción</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400">Porcentaje sobre las vistas de producto</p>
            </div>

            <ol class="mt-4 space-y-3">
              @for (step of funnelSteps(); track step.label) {
                <li>
                  <div class="flex items-center justify-between gap-3 text-sm">
                    <span class="text-gray-700 dark:text-gray-200">{{ step.label }}</span>
                    <span class="text-gray-500 dark:text-gray-400 tabular-nums">
                      {{ formatNumber(step.value) }}
                      <span class="ml-2 font-medium text-gray-900 dark:text-white">
                        {{ step.percent == null ? '—' : step.percent + '%' }}
                      </span>
                    </span>
                  </div>
                  <div class="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div class="h-full rounded-full bg-amber-600 dark:bg-amber-400"
                         [style.width.%]="funnelWidth(step.percent)"></div>
                  </div>
                  <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ step.hint }}</p>
                </li>
              } @empty {
                <li class="text-sm text-gray-400 dark:text-gray-500">Sin datos.</li>
              }
            </ol>
          </section>
        }
        }
      </div>
    </div>
  `,
})
export class MetricsComponent implements OnInit {
  private readonly metricsService = inject(MetricsService);
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);

  protected readonly ranges = METRICS_RANGES;
  protected readonly days = signal<MetricsDays>(7);
  protected readonly tab = signal<MetricsTab>('trafico');
  protected readonly summary = signal<MetricsSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  private loadToken = 0;

  ngOnInit(): void {
    void this.load();
  }

  protected selectTab(tab: MetricsTab): void {
    this.tab.set(tab);
  }

  protected tabClass(tab: MetricsTab): string {
    const base = 'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ';
    return this.tab() === tab
      ? `${base}border-amber-600 text-amber-700 dark:text-amber-300`
      : `${base}border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200`;
  }

  protected selectDays(days: MetricsDays): void {
    if (this.days() === days) return;
    this.days.set(days);
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  /** Serie diaria completa: el backend omite días sin eventos, aquí se rellenan con 0. */
  protected readonly trend = computed<MetricsDailyPoint[]>(() => {
    const summary = this.summary();
    if (!summary?.range?.from || !summary?.range?.to) return [];

    const byDate = new Map<string, MetricsDailyPoint>();
    for (const day of summary.daily ?? []) byDate.set(day.date, day);

    const points: MetricsDailyPoint[] = [];
    let cursor = summary.range.from;
    for (let index = 0; index < 400 && cursor <= summary.range.to; index += 1) {
      const point = byDate.get(cursor);
      points.push({
        date: cursor,
        pageViews: point?.pageViews ?? 0,
        visitors: point?.visitors ?? 0,
      });
      cursor = nextDay(cursor);
    }
    return points;
  });

  protected readonly maxPageViews = computed(() =>
    this.trend().reduce((max, day) => Math.max(max, day.pageViews), 0)
  );

  protected readonly kpis = computed<KpiCard[]>(() => {
    const summary = this.summary();
    if (!summary) return [];

    const mostViewed = summary.topProducts?.[0];
    return [
      {
        label: 'Visitas',
        value: this.formatNumber(summary.totals.pageViews),
        hint: 'Vistas de página registradas',
      },
      {
        label: 'Visitantes únicos',
        value: this.formatNumber(summary.totals.visitors),
        hint: 'Un identificador por navegador',
      },
      {
        label: 'Sesiones',
        value: this.formatNumber(summary.totals.sessions),
        hint: 'Se reinicia tras 30 min sin actividad',
      },
      {
        label: 'Producto más visto',
        value: mostViewed ? this.productName(mostViewed.productId) : '—',
        hint: mostViewed ? `${this.formatNumber(mostViewed.views)} vistas` : 'Sin vistas de producto',
      },
    ];
  });

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

  protected barHeight(pageViews: number): number {
    const max = this.maxPageViews();
    if (pageViews <= 0 || max <= 0) return 0;
    return Math.max(3, Math.round((pageViews / max) * 100));
  }

  protected dayLabel(date: string): string {
    try {
      const parsed = new Date(`${date}T12:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return date;
      return new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC',
      }).format(parsed);
    } catch {
      return date;
    }
  }

  protected dayTitle(day: MetricsDailyPoint): string {
    return `${this.dayLabel(day.date)}: ${this.formatNumber(day.pageViews)} visitas · ${this.formatNumber(day.visitors)} visitantes`;
  }

  protected productName(productId: number): string {
    const product = this.productService.products().find((item) => item.id === productId);
    const name = product?.name?.trim();
    return name && name.length > 0 ? name : `Producto #${productId}`;
  }

  protected productLink(productId: number): string | null {
    const product = this.productService.products().find((item) => item.id === productId);
    return product?.slug ? `/product/${product.slug}` : null;
  }

  protected categoryName(categoryId: number): string {
    const category = this.categoryService.categories().find((item) => item.id === categoryId);
    const name = category?.name?.trim();
    return name && name.length > 0 ? name : `Categoría #${categoryId}`;
  }

  protected readonly funnelSteps = computed<FunnelStep[]>(() => {
    const summary = this.summary();
    if (!summary) return [];

    const funnel = summary.funnel;
    const base = funnel.productViews || 0;
    const steps: Array<{ label: string; value: number; hint: string }> = [
      { label: 'Producto visto', value: funnel.productViews, hint: 'Base del embudo: vistas de detalle de producto' },
      { label: 'Agregado a cotización', value: funnel.addToQuote, hint: 'Clics en "Agregar a cotización"' },
      { label: 'Cotización abierta', value: funnel.quoteOpens, hint: 'Visitas a la página de cotización' },
      { label: 'PDF descargado', value: funnel.pdfDownloads, hint: 'Descargas del PDF de la cotización' },
      { label: 'Clic en contacto', value: funnel.contactClicks, hint: 'Clics en la barra de contacto' },
    ];

    return steps.map((step) => ({
      ...step,
      percent: base > 0 ? Math.round((step.value / base) * 1000) / 10 : null,
    }));
  });

  protected funnelWidth(percent: number | null): number {
    if (percent == null || percent <= 0) return 0;
    return Math.min(100, Math.max(2, percent));
  }

  /**
   * Exporta el resumen a CSV en el navegador (Blob + Object URL).
   * Incluye la serie diaria y las secciones de top productos/categorías/eventos.
   */
  protected exportCsv(): void {
    const summary = this.summary();
    if (!summary) return;

    try {
      const rows: string[] = ['date,pageViews,visitors'];
      for (const day of this.trend()) {
        rows.push(`${day.date},${day.pageViews},${day.visitors}`);
      }

      rows.push('', 'topProductId,productName,views');
      for (const product of summary.topProducts ?? []) {
        rows.push(
          `${product.productId},${this.csvField(this.productName(product.productId))},${product.views}`
        );
      }

      rows.push('', 'topCategoryId,categoryName,views');
      for (const category of summary.topCategories ?? []) {
        rows.push(
          `${category.categoryId},${this.csvField(this.categoryName(category.categoryId))},${category.views}`
        );
      }

      rows.push('', 'event,count');
      for (const event of summary.events ?? []) {
        rows.push(`${event.type},${event.count}`);
      }

      // BOM para que Excel detecte UTF-8 (acentos y eñes).
      const blob = new Blob([`\ufeff${rows.join('\r\n')}\r\n`], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `metricas-${summary.range.days}d-${this.todayIso()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // La exportación nunca debe romper el panel.
    }
  }

  private csvField(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private todayIso(): string {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
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
