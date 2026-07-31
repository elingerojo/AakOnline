import { Component, inject, computed, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ProductService, type ProductFilter } from '../../core/services/product.service';
import { getCategoryName } from '@shared/models/category-lookup.model';
import type { Product } from '@shared/models/product.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <!-- Migration legend -->
      <div class="flex items-center gap-4 px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        <span class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded-full bg-green-100 dark:bg-green-900/40 border border-green-400 dark:border-green-700 inline-block"></span>
          Migrado a Neon (imagen en Vercel Blob)
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 inline-block"></span>
          Pendiente de migrar (imagen local)
        </span>
      </div>

      <!-- Status filter tabs -->
      <div class="flex flex-wrap gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
        @for (item of filterList(); track item.key) {
          <button
            (click)="setFilter(item.key)"
            class="px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer"
            [class.bg-amber-600]="currentFilter() === item.key"
            [class.text-white]="currentFilter() === item.key"
            [class.bg-gray-100]="currentFilter() !== item.key"
            [class.dark:bg-gray-700]="currentFilter() !== item.key"
            [class.text-gray-700]="currentFilter() !== item.key"
            [class.dark:text-gray-300]="currentFilter() !== item.key"
            class="hover:bg-amber-50 dark:hover:bg-gray-600"
          >
            {{ item.label }}
            <span class="ml-1 text-xs opacity-75">({{ item.count }})</span>
          </button>
        }
      </div>

      <!-- Products table -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">SKU</th>
              <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Nombre</th>
              <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Categoria</th>
              <th class="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Precio</th>
              <th class="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Estado</th>
              <th class="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            @for (product of productService.filteredProducts(); track product.id) {
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  [class.bg-green-50]="isMigrated(product)"
                  [class.dark:bg-green-900/20]="isMigrated(product)">
                <td class="px-4 py-3">
                  <span class="inline-flex items-center gap-1.5">
                    @if (isMigrated(product)) {
                      <span class="w-2 h-2 rounded-full bg-green-500" title="Migrado a Neon"></span>
                    } @else {
                      <span class="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" title="Pendiente de migrar"></span>
                    }
                    <span class="text-gray-900 dark:text-white font-mono text-xs">{{ product.sku }}</span>
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <img [src]="product.image" alt="" class="w-10 h-10 rounded object-cover" loading="lazy" />
                    <span class="text-gray-900 dark:text-white font-medium">{{ product.name ?? 'Sin nombre' }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400">{{ getCategoryName(product.categoryId) }}</td>
                <td class="px-4 py-3 text-right text-gray-900 dark:text-white">
                  @if (product.currentPrice > 0) {
                    {{ product.currentPrice | currency:'MXN':'symbol-narrow':'1.0-0' }}
                  } @else {
                    <span class="text-gray-400">—</span>
                  }
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="px-2 py-0.5 text-xs font-medium rounded-full"
                    [class.bg-yellow-100]="product.status === 'pendiente'"
                    [class.text-yellow-800]="product.status === 'pendiente'"
                    [class.bg-green-100]="product.status === 'activo'"
                    [class.text-green-800]="product.status === 'activo'"
                    [class.bg-red-100]="product.status === 'suspendido'"
                    [class.text-red-800]="product.status === 'suspendido'"
                    [class.bg-gray-100]="product.status === 'almacenado'"
                    [class.text-gray-800]="product.status === 'almacenado'"
                  >
                    {{ product.status }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button (click)="editProduct.emit(product)"
                          class="text-amber-600 hover:text-amber-700 text-xs font-medium cursor-pointer">
                    Editar
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  No hay productos en esta categoria.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AdminDashboardComponent {
  protected productService = inject(ProductService);

  /** Emit when user clicks "Editar" on a product */
  readonly editProduct = output<Product>();

  protected filterList = computed(() => {
    const counts = this.productService.statusCounts();
    return [
      { key: 'all' as ProductFilter, label: 'Todos', count: counts.all },
      { key: 'pendiente' as ProductFilter, label: 'Pendientes', count: counts.pendiente },
      { key: 'activo' as ProductFilter, label: 'Activos', count: counts.activo },
      { key: 'suspendido' as ProductFilter, label: 'Suspendidos', count: counts.suspendido },
      { key: 'almacenado' as ProductFilter, label: 'Almacenados', count: counts.almacenado },
    ];
  });

  protected currentFilter = this.productService.filter;

  setFilter(key: ProductFilter): void {
    this.productService.filter.set(key);
  }

  protected getCategoryName = getCategoryName;

  /**
   * Un producto está migrado a Neon si su imagen principal es una URL de Vercel Blob
   * (https://...). Si la imagen es una ruta local (assets/...), aún no está migrado.
   */
  protected isMigrated(product: Product): boolean {
    return product.image?.startsWith('https://') ?? false;
  }
}
