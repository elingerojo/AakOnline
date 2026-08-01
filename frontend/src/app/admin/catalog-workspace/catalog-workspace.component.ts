import { Component, inject, signal, type OnInit } from '@angular/core';
import { AdminDashboardComponent } from '../dashboard/dashboard.component';
import { ProductFormComponent } from '../product-form/product-form.component';
import { AdminNavComponent } from '../admin-nav/admin-nav.component';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ProductService } from '../../core/services/product.service';
import type { Product } from '@shared/models/product.model';

@Component({
  selector: 'app-catalog-workspace',
  standalone: true,
  imports: [AdminDashboardComponent, ProductFormComponent, AdminNavComponent],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <!-- Admin Header -->
      <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">Admin - Catalogo</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">Gestion de productos</p>
          </div>
          <div class="flex items-center gap-4">
            <app-admin-nav />
            <button (click)="showForm.set(true)"
                    class="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors cursor-pointer">
              + Nuevo producto
            </button>
          </div>
        </div>
      </header>

      <div class="max-w-7xl mx-auto px-4 py-6">
        @if (showForm()) {
          <!-- Product Form -->
          <div class="mb-8">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ editingProduct() ? 'Editar producto' : 'Nuevo producto' }}
              </h2>
              <button (click)="closeForm()"
                      class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">
                Cerrar
              </button>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <app-product-form
                [editingProduct]="editingProduct()"
                (saved)="onSaved()"
                (cancel)="closeForm()"
              />
            </div>
          </div>
        }

        <!-- Dashboard Table -->
        <app-admin-dashboard (editProduct)="onEditProduct($event)" />
      </div>
    </div>
  `,
})
export class CatalogWorkspaceComponent implements OnInit {
  protected showForm = signal(false);
  protected editingProduct = signal<Product | null>(null);

  private adminApi = inject(AdminApiService);
  private productService = inject(ProductService);

  ngOnInit(): void {
    this.loadFromNeon();
  }

  /**
   * Pre-carga los productos desde la API (Neon-first, con JSON-fallback en el backend)
   * para que el dashboard muestre el estado real de migración desde el primer render.
   */
  private async loadFromNeon(): Promise<void> {
    try {
      const products = await this.adminApi.getProducts();
      this.productService.setProducts(products);
    } catch (err) {
      console.warn('[Catalog] No se pudo precargar desde Neon; se usa el JSON local:', err);
    }
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingProduct.set(null);
  }

  onSaved(): void {
    this.closeForm();
  }

  onEditProduct(product: Product): void {
    this.editingProduct.set(product);
    this.showForm.set(true);
  }
}
