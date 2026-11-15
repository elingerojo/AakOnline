import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import type { SeoSnapshot } from './seo.service';
import {
  MAX_OPPORTUNITY_ROWS,
  OPPORTUNITY_LABELS,
  buildOpportunities,
  countOpportunities,
  type OpportunityKind,
  type OpportunityRow,
} from './seo-opportunities.util';

/** Versión mínima del snapshot que incluye `pageQueries`. */
const MIN_SNAPSHOT_VERSION = 2;

/**
 * Tabla de oportunidades SEO calculada en el cliente a partir del snapshot de
 * Search Console y del catálogo local (Corte 4b).
 *
 * No hace peticiones: recibe el snapshot del panel y solo deriva acciones.
 */
@Component({
  selector: 'app-seo-opportunities',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Oportunidades SEO</h2>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Reglas: CTR bajo con ≥ 100 impresiones, sin clics con ≥ 50 impresiones, productos activos sin
            impresiones y productos no activos (invisibles para Google).
          </p>
        </div>
        @if (!needsRefresh()) {
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ rows().length }} de {{ total() }} oportunidades · máximo {{ maxRows }} filas
          </p>
        }
      </div>

      @if (needsRefresh()) {
        <div class="mt-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <p class="text-sm text-amber-800 dark:text-amber-300">
            Actualiza para ver oportunidades: el snapshot guardado es v{{ snapshot()?.version }} y esta tabla
            necesita la versión {{ minVersion }} (páginas × consultas).
          </p>
        </div>
      } @else {
        <!-- Contadores por tipo -->
        <div class="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          @for (card of counters(); track card.kind) {
            <div class="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ card.label }}
              </p>
              <p class="mt-1 text-xl font-bold text-gray-900 dark:text-white tabular-nums">{{ card.count }}</p>
            </div>
          }
        </div>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th class="py-2 pr-2 font-medium">Página / Producto</th>
                <th class="py-2 px-2 font-medium">SKU</th>
                <th class="py-2 px-2 font-medium text-right">Impr.</th>
                <th class="py-2 px-2 font-medium text-right">Clics</th>
                <th class="py-2 px-2 font-medium text-right">CTR</th>
                <th class="py-2 px-2 font-medium text-right">Pos.</th>
                <th class="py-2 px-2 font-medium">Consultas top</th>
                <th class="py-2 pl-2 font-medium">Acción sugerida</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.kind + row.path) {
                <tr class="border-t border-gray-100 dark:border-gray-700 align-top">
                  <td class="py-2 pr-2 max-w-[18rem]">
                    <div class="flex items-start gap-2">
                      <span [class]="badgeClass(row.kind)" [attr.title]="kindLabel(row.kind)">
                        {{ kindShort(row.kind) }}
                      </span>
                      <div class="min-w-0">
                        <a [routerLink]="row.path"
                           class="block truncate text-gray-800 dark:text-gray-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                           [attr.title]="row.path">
                          {{ row.name || row.path }}
                        </a>
                        <a routerLink="/admin"
                           class="text-xs text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                          Editar en /admin
                        </a>
                      </div>
                    </div>
                  </td>
                  <td class="py-2 px-2 text-xs text-gray-500 dark:text-gray-400 font-mono">{{ row.sku || '—' }}</td>
                  <td class="py-2 px-2 text-right tabular-nums text-gray-900 dark:text-white">{{ formatNumber(row.impressions) }}</td>
                  <td class="py-2 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatNumber(row.clicks) }}</td>
                  <td class="py-2 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatPercent(row.ctr) }}</td>
                  <td class="py-2 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ formatPosition(row.position) }}</td>
                  <td class="py-2 px-2 text-xs text-gray-500 dark:text-gray-400 max-w-[14rem]">
                    @if (row.topQueries.length > 0) {
                      <ul class="space-y-0.5">
                        @for (query of row.topQueries; track query) {
                          <li class="truncate" [attr.title]="query">{{ query }}</li>
                        }
                      </ul>
                    } @else {
                      <span>—</span>
                    }
                  </td>
                  <td class="py-2 pl-2 text-xs font-medium text-gray-700 dark:text-gray-200">{{ row.action }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="py-3 text-gray-400 dark:text-gray-500">
                    Sin oportunidades con las reglas actuales.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class SeoOpportunitiesComponent {
  private readonly productService = inject(ProductService);

  /** Snapshot servido por el panel SEO (puede ser v1). */
  readonly snapshot = input<SeoSnapshot | null>(null);

  protected readonly maxRows = MAX_OPPORTUNITY_ROWS;
  protected readonly minVersion = MIN_SNAPSHOT_VERSION;

  protected readonly needsRefresh = computed(() => {
    const snapshot = this.snapshot();
    if (!snapshot) return false;
    return Number(snapshot.version ?? 1) < MIN_SNAPSHOT_VERSION;
  });

  protected readonly rows = computed<OpportunityRow[]>(() =>
    buildOpportunities(this.snapshot(), this.productService.products())
  );

  protected readonly total = computed(() =>
    buildOpportunities(this.snapshot(), this.productService.products(), Number.MAX_SAFE_INTEGER).length
  );

  protected readonly counters = computed(() => {
    const counts = countOpportunities(this.rows());
    return (Object.keys(OPPORTUNITY_LABELS) as OpportunityKind[]).map((kind) => ({
      kind,
      label: OPPORTUNITY_LABELS[kind],
      count: counts[kind],
    }));
  });

  protected kindLabel(kind: OpportunityKind): string {
    return OPPORTUNITY_LABELS[kind];
  }

  /** Marca corta para no ensanchar la primera columna. */
  protected kindShort(kind: OpportunityKind): string {
    const short: Record<OpportunityKind, string> = {
      lowCtr: 'CTR',
      noClicks: '0 clics',
      noImpressions: '0 impr.',
      pendingInvisible: 'No activo',
    };
    return short[kind];
  }

  protected badgeClass(kind: OpportunityKind): string {
    const base =
      'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap';
    const tone: Record<OpportunityKind, string> = {
      lowCtr: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
      noClicks: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
      noImpressions: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300',
      pendingInvisible: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200',
    };
    return `${base} ${tone[kind]}`;
  }

  protected formatNumber(value: number | null | undefined): string {
    return Number(value ?? 0).toLocaleString('es-MX');
  }

  protected formatPercent(ctr: number | null | undefined): string {
    return `${(Number(ctr ?? 0) * 100).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} %`;
  }

  protected formatPosition(position: number | null | undefined): string {
    const value = Number(position ?? 0);
    return value > 0 ? value.toFixed(2) : '—';
  }
}
