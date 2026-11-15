import { Component, computed, inject, signal, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import {
  SEO_DEFAULT_DAYS,
  SeoService,
  type SeoDailyRow,
  type SeoSnapshot,
} from './seo.service';
import { SeoOpportunitiesComponent } from './seo-opportunities.component';

const SEARCH_CONSOLE_URL = 'https://search.google.com/search-console';

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

interface DisconnectedState {
  reason: string;
  message: string;
  lastError: string | null;
}

interface PageInfo {
  label: string;
  link: string | null;
}

/**
 * Pestaña SEO de `/admin/metrics`: clics, impresiones, CTR, posición media,
 * consultas, páginas y dispositivos de Google Search Console (snapshot de 28
 * días con 3 días de retraso, cacheado en Neon).
 */
@Component({
  selector: 'app-seo-panel',
  standalone: true,
  imports: [RouterLink, SeoOpportunitiesComponent],
  template: `
    @if (loading()) {
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
           role="status" aria-live="polite">
        <p class="text-sm text-gray-500 dark:text-gray-400">Consultando Search Console…</p>
        <div class="mt-4 space-y-3">
          <div class="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
          <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
          <div class="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        </div>
      </div>
    } @else if (error()) {
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-6">
        <h2 class="text-sm font-semibold text-red-700 dark:text-red-300">No se pudo consultar Search Console</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ error() }}</p>
        <button type="button" (click)="reload()"
                class="mt-4 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 cursor-pointer">
          Reintentar
        </button>
      </div>
    } @else if (disconnected(); as offline) {
      <section class="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 p-6 space-y-4">
        <div>
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Search Console sin datos todavía</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ offline.message }}</p>
          <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Motivo reportado por el backend: <span class="font-mono">{{ offline.reason }}</span>
          </p>
          @if (offline.lastError) {
            <p class="mt-2 text-xs text-red-600 dark:text-red-300 break-words">
              Último error: {{ offline.lastError }}
            </p>
          }
        </div>

        <div class="text-sm text-gray-600 dark:text-gray-300">
          <p class="font-medium text-gray-900 dark:text-white">Para conectarlo</p>
          <ol class="mt-2 list-decimal list-inside space-y-1">
            <li>Habilitar <span class="font-medium">Google Search Console API</span> en Google Cloud Console.</li>
            <li>Crear una service account y descargar su llave JSON.</li>
            <li>
              Agregar el correo de la service account en Search Console → Configuración → Usuarios y
              permisos con permiso <span class="font-medium">Restringido</span>.
            </li>
            <li>
              En Railway, definir <span class="font-mono text-xs">SEARCH_CONSOLE_SA_JSON</span> (JSON crudo o
              base64) y <span class="font-mono text-xs">SEARCH_CONSOLE_SITE_URL=https://aakbejuco.com/</span>.
            </li>
            <li>Redesplegar el backend y pulsar "Actualizar".</li>
          </ol>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button type="button" (click)="refresh()" [disabled]="refreshing()"
                  class="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700
                         disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors">
            {{ refreshing() ? 'Consultando…' : 'Actualizar' }}
          </button>
          <a [href]="searchConsoleUrl" target="_blank" rel="noopener noreferrer"
             class="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline">
            Abrir Search Console
          </a>
        </div>

        @if (notice()) {
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ notice() }}</p>
        }
      </section>
    } @else if (snapshot(); as s) {
      <!-- Cabecera del snapshot -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ s.range.startDate }} → {{ s.range.endDate }} ({{ s.range.days }} días)
            · actualizado {{ fetchedLabel() }}
            @if (stale()) {
              <span class="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40
                           px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                caché de más de 24 h
              </span>
            }
          </p>
          <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Google publica con 2–3 días de retraso: la ventana termina {{ s.range.lagDays }} días antes de hoy.
          </p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <a [href]="searchConsoleUrl" target="_blank" rel="noopener noreferrer"
             class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600
                    text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Abrir Search Console
          </a>
          <button type="button" (click)="refresh()" [disabled]="refreshing()"
                  aria-label="Actualizar datos de Search Console"
                  class="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700
                         disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors">
            {{ refreshing() ? 'Actualizando…' : 'Actualizar' }}
          </button>
        </div>
      </div>

      @if (notice()) {
        <div class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2">
          <p class="text-xs text-amber-800 dark:text-amber-300">{{ notice() }}</p>
        </div>
      }

      <!-- KPIs -->
      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Indicadores de Search Console">
        @for (card of kpis(); track card.label) {
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ card.label }}</p>
            <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white break-words">{{ card.value }}</p>
            <p class="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate" [attr.title]="card.hint">{{ card.hint }}</p>
          </div>
        }
      </section>

      <!-- Tendencia diaria -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div class="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Clics por día</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">Máximo {{ formatNumber(maxClicks()) }}</p>
          </div>
          <div class="mt-4 flex items-end gap-px h-40 overflow-hidden" role="img"
               [attr.aria-label]="'Clics por día del ' + s.range.startDate + ' al ' + s.range.endDate">
            @for (day of trend(); track day.date) {
              <div class="flex-1 min-w-0 h-full flex items-end">
                <div class="w-full rounded-t bg-amber-500 dark:bg-amber-400"
                     [style.height.%]="barHeight(day.clicks, maxClicks())"
                     [attr.title]="dayTitle(day)"></div>
              </div>
            }
          </div>
          <div class="mt-2 flex justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>{{ dayLabel(s.range.startDate) }}</span>
            <span>{{ dayLabel(s.range.endDate) }}</span>
          </div>
        </section>

        <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div class="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Impresiones por día</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">Máximo {{ formatNumber(maxImpressions()) }}</p>
          </div>
          <div class="mt-4 flex items-end gap-px h-40 overflow-hidden" role="img"
               [attr.aria-label]="'Impresiones por día del ' + s.range.startDate + ' al ' + s.range.endDate">
            @for (day of trend(); track day.date) {
              <div class="flex-1 min-w-0 h-full flex items-end">
                <div class="w-full rounded-t bg-sky-500 dark:bg-sky-400"
                     [style.height.%]="barHeight(day.impressions, maxImpressions())"
                     [attr.title]="dayTitle(day)"></div>
              </div>
            }
          </div>
          <div class="mt-2 flex justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>{{ dayLabel(s.range.startDate) }}</span>
            <span>{{ dayLabel(s.range.endDate) }}</span>
          </div>
        </section>
      </div>

      <!-- Consultas y páginas -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Top 20 consultas</h2>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th class="py-2 pr-2 font-medium">Consulta</th>
                  <th class="py-2 px-2 font-medium text-right">Clics</th>
                  <th class="py-2 px-2 font-medium text-right">Impr.</th>
                  <th class="py-2 px-2 font-medium text-right">CTR</th>
                  <th class="py-2 pl-2 font-medium text-right">Pos.</th>
                </tr>
              </thead>
              <tbody>
                @for (row of topQueries(); track row.query) {
                  <tr class="border-t border-gray-100 dark:border-gray-700">
                    <td class="py-1.5 pr-2 text-gray-700 dark:text-gray-200 max-w-[16rem] truncate" [attr.title]="row.query">
                      {{ row.query }}
                    </td>
                    <td class="py-1.5 px-2 text-right tabular-nums text-gray-900 dark:text-white">{{ formatNumber(row.clicks) }}</td>
                    <td class="py-1.5 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatNumber(row.impressions) }}</td>
                    <td class="py-1.5 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatPercent(row.ctr) }}</td>
                    <td class="py-1.5 pl-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatPosition(row.position) }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="py-3 text-gray-400 dark:text-gray-500">Sin consultas en el periodo.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Top 20 páginas</h2>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th class="py-2 pr-2 font-medium">Página</th>
                  <th class="py-2 px-2 font-medium text-right">Clics</th>
                  <th class="py-2 px-2 font-medium text-right">Impr.</th>
                  <th class="py-2 px-2 font-medium text-right">CTR</th>
                  <th class="py-2 pl-2 font-medium text-right">Pos.</th>
                </tr>
              </thead>
              <tbody>
                @for (row of topPages(); track row.page) {
                  <tr class="border-t border-gray-100 dark:border-gray-700">
                    <td class="py-1.5 pr-2 text-gray-700 dark:text-gray-200 max-w-[16rem] truncate" [attr.title]="row.page">
                      @if (pageInfo(row.page).link; as link) {
                        <a [routerLink]="link" class="hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                          {{ pageInfo(row.page).label }}
                        </a>
                      } @else {
                        {{ pageInfo(row.page).label }}
                      }
                    </td>
                    <td class="py-1.5 px-2 text-right tabular-nums text-gray-900 dark:text-white">{{ formatNumber(row.clicks) }}</td>
                    <td class="py-1.5 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatNumber(row.impressions) }}</td>
                    <td class="py-1.5 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatPercent(row.ctr) }}</td>
                    <td class="py-1.5 pl-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatPosition(row.position) }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="py-3 text-gray-400 dark:text-gray-500">Sin páginas en el periodo.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Dispositivos -->
      <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Dispositivos</h2>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th class="py-2 pr-2 font-medium">Dispositivo</th>
                <th class="py-2 px-2 font-medium text-right">Clics</th>
                <th class="py-2 px-2 font-medium text-right">Impresiones</th>
                <th class="py-2 px-2 font-medium text-right">CTR</th>
                <th class="py-2 pl-2 font-medium text-right">Posición media</th>
              </tr>
            </thead>
            <tbody>
              @for (row of s.devices; track row.device) {
                <tr class="border-t border-gray-100 dark:border-gray-700">
                  <td class="py-1.5 pr-2 text-gray-700 dark:text-gray-200">{{ deviceLabel(row.device) }}</td>
                  <td class="py-1.5 px-2 text-right tabular-nums text-gray-900 dark:text-white">{{ formatNumber(row.clicks) }}</td>
                  <td class="py-1.5 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatNumber(row.impressions) }}</td>
                  <td class="py-1.5 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatPercent(row.ctr) }}</td>
                  <td class="py-1.5 pl-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatPosition(row.position) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="py-3 text-gray-400 dark:text-gray-500">Sin datos de dispositivos.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Propiedad <span class="font-mono">{{ s.siteUrl }}</span> · snapshot v{{ s.version }}
        </p>
      </section>

      <!-- Oportunidades calculadas a partir del snapshot + catálogo local -->
      <app-seo-opportunities [snapshot]="s" />
    }
  `,
})
export class SeoPanelComponent implements OnInit {
  private readonly seoService = inject(SeoService);
  private readonly productService = inject(ProductService);

  protected readonly searchConsoleUrl = SEARCH_CONSOLE_URL;

  protected readonly snapshot = signal<SeoSnapshot | null>(null);
  protected readonly fetchedAt = signal<string | null>(null);
  protected readonly stale = signal(false);
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly disconnected = signal<DisconnectedState | null>(null);

  private loadToken = 0;

  ngOnInit(): void {
    void this.load();
  }

  protected reload(): void {
    void this.load();
  }

  /** Serie diaria completa: Google omite días sin impresiones, se rellenan con 0. */
  protected readonly trend = computed<SeoDailyRow[]>(() => {
    const snapshot = this.snapshot();
    if (!snapshot?.range?.startDate || !snapshot?.range?.endDate) return [];

    const byDate = new Map<string, SeoDailyRow>();
    for (const day of snapshot.daily ?? []) byDate.set(day.date, day);

    const rows: SeoDailyRow[] = [];
    let cursor = snapshot.range.startDate;
    for (let index = 0; index < 400 && cursor <= snapshot.range.endDate; index += 1) {
      rows.push(
        byDate.get(cursor) ?? { date: cursor, clicks: 0, impressions: 0, ctr: 0, position: 0 }
      );
      cursor = nextDay(cursor);
    }
    return rows;
  });

  protected readonly maxClicks = computed(() =>
    this.trend().reduce((max, day) => Math.max(max, day.clicks), 0)
  );

  protected readonly maxImpressions = computed(() =>
    this.trend().reduce((max, day) => Math.max(max, day.impressions), 0)
  );

  protected readonly kpis = computed<KpiCard[]>(() => {
    const totals = this.snapshot()?.totals;
    if (!totals) return [];
    return [
      { label: 'Clics', value: this.formatNumber(totals.clicks), hint: 'Clics desde resultados de Google' },
      { label: 'Impresiones', value: this.formatNumber(totals.impressions), hint: 'Veces que aparecimos en Google' },
      { label: 'CTR', value: this.formatPercent(totals.ctr), hint: 'Clics entre impresiones' },
      { label: 'Posición media', value: this.formatPosition(totals.position), hint: 'Ponderada por impresiones' },
    ];
  });

  protected readonly topQueries = computed(() => (this.snapshot()?.queries ?? []).slice(0, 20));

  protected readonly topPages = computed(() => (this.snapshot()?.pages ?? []).slice(0, 20));

  protected readonly fetchedLabel = computed(() => {
    const fetchedAt = this.fetchedAt() ?? this.snapshot()?.fetchedAt ?? null;
    if (!fetchedAt) return '—';
    try {
      const date = new Date(fetchedAt);
      if (Number.isNaN(date.getTime())) return fetchedAt;
      return new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return fetchedAt;
    }
  });

  protected formatNumber(value: number | null | undefined): string {
    return Number(value ?? 0).toLocaleString('es-MX');
  }

  /** Google devuelve CTR como fracción (0–1); se muestra en porcentaje. */
  protected formatPercent(ctr: number | null | undefined): string {
    const value = Number(ctr ?? 0) * 100;
    return `${value.toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} %`;
  }

  protected formatPosition(position: number | null | undefined): string {
    const value = Number(position ?? 0);
    return value > 0 ? value.toFixed(2) : '—';
  }

  protected deviceLabel(device: string): string {
    const labels: Record<string, string> = {
      MOBILE: 'Móvil',
      DESKTOP: 'Escritorio',
      TABLET: 'Tablet',
    };
    return labels[device.toUpperCase()] ?? device;
  }

  protected barHeight(value: number, max: number): number {
    if (value <= 0 || max <= 0) return 0;
    return Math.max(3, Math.round((value / max) * 100));
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

  protected dayTitle(day: SeoDailyRow): string {
    return `${this.dayLabel(day.date)}: ${this.formatNumber(day.clicks)} clics · ${this.formatNumber(
      day.impressions
    )} impresiones · CTR ${this.formatPercent(day.ctr)} · pos. ${this.formatPosition(day.position)}`;
  }

  /** Mapea una URL de Google a la ruta interna y, si es producto, a su nombre. */
  protected pageInfo(page: string): PageInfo {
    const path = this.pathFromUrl(page);
    const productPrefix = '/product/';
    if (path.startsWith(productPrefix)) {
      const slug = decodeURIComponent(path.slice(productPrefix.length)).replace(/\/$/, '');
      const product = this.productService.products().find((item) => item.slug === slug);
      return {
        label: product?.name?.trim() || path,
        link: product?.slug ? `/product/${product.slug}` : null,
      };
    }
    return { label: path, link: null };
  }

  private pathFromUrl(page: string): string {
    try {
      return new URL(page).pathname || '/';
    } catch {
      return page;
    }
  }

  private async load(): Promise<void> {
    const token = ++this.loadToken;
    this.loading.set(true);
    this.error.set('');
    this.notice.set('');

    try {
      const response = await this.seoService.getSummary(SEO_DEFAULT_DAYS);
      if (token !== this.loadToken) return;

      if (response.connected && response.snapshot) {
        this.snapshot.set(response.snapshot);
        this.fetchedAt.set(response.fetchedAt ?? response.snapshot.fetchedAt);
        this.stale.set(Boolean(response.stale));
        this.disconnected.set(null);
      } else {
        this.snapshot.set(null);
        this.fetchedAt.set(null);
        this.stale.set(false);
        this.disconnected.set({
          reason: response.reason ?? 'no-data',
          message:
            response.message ??
            'Search Console no está conectado o aún no hay datos publicados para esta propiedad.',
          lastError: response.lastError ?? null,
        });
      }
    } catch (error) {
      if (token !== this.loadToken) return;
      this.snapshot.set(null);
      this.disconnected.set(null);
      this.error.set(
        error instanceof Error && error.message
          ? error.message
          : 'Error desconocido al consultar Search Console.'
      );
    } finally {
      if (token === this.loadToken) this.loading.set(false);
    }
  }

  protected async refresh(): Promise<void> {
    if (this.refreshing()) return;

    this.refreshing.set(true);
    this.notice.set('');
    this.error.set('');

    try {
      const response = await this.seoService.refresh(SEO_DEFAULT_DAYS);

      if (response.connected && response.snapshot) {
        this.snapshot.set(response.snapshot);
        this.fetchedAt.set(response.fetchedAt ?? response.snapshot.fetchedAt);
        this.stale.set(false);
        this.disconnected.set(null);
        this.notice.set('Datos actualizados desde Search Console.');
        return;
      }

      const message = response.message ?? 'Google no devolvió datos en esta actualización.';
      if (this.snapshot()) {
        this.notice.set(message);
      } else {
        this.disconnected.set({
          reason: response.reason ?? 'no-data',
          message,
          lastError: response.lastError ?? null,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Error desconocido al actualizar Search Console.';
      if (this.snapshot()) {
        this.notice.set(`No se pudo actualizar: ${message}`);
      } else {
        this.error.set(message);
      }
    } finally {
      this.refreshing.set(false);
    }
  }
}
