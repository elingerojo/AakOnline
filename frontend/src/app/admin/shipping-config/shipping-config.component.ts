import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ShippingService } from '../../core/services/shipping.service';
import { formatCurrency } from '../../core/utils/text-utils';
import type { ShippingConfig, DistanceTier } from '@shared/models/shipping-config.model';

@Component({
  selector: 'app-shipping-config',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 py-4">
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">Admin - Configuracion de Envio</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">Tarifas por categoria y distancia</p>
        </div>
      </header>

      <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
        @if (saveSuccess()) {
          <div class="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700
                      text-green-800 dark:text-green-300 px-4 py-3 rounded-lg">
            ✓ Cambios guardados exitosamente
          </div>
        }
        @if (saveError()) {
          <div class="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700
                      text-red-800 dark:text-red-300 px-4 py-3 rounded-lg">
            {{ saveError() }}
          </div>
        }

        @for (config of configs(); track config.categoryId) {
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ config.categoryName }}</h2>
                  <label class="text-sm text-gray-500 dark:text-gray-400">
                    Factor por unidad extra:
                    <input type="number" [(ngModel)]="config.extraUnitFactor"
                           step="0.1" min="0" max="2"
                           class="w-20 ml-2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded
                                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    ({{ config.extraUnitFactor * 100 }}%)
                  </label>
                </div>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-gray-50 dark:bg-gray-700/30">
                    <th class="text-left px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Desde (km)</th>
                    <th class="text-left px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Hasta (km)</th>
                    <th class="text-right px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Precio (MXN)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  @for (tier of config.tiers; track tier.minKm; let ti = $index) {
                    <tr>
                      <td class="px-6 py-3">
                        <input type="number" [(ngModel)]="tier.minKm"
                               [name]="'min-' + config.categoryId + '-' + ti"
                               class="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </td>
                      <td class="px-6 py-3">
                        <input type="number" [(ngModel)]="tier.maxKm"
                               [name]="'max-' + config.categoryId + '-' + ti"
                               class="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </td>
                      <td class="px-6 py-3 text-right">
                        <input type="number" [(ngModel)]="tier.price"
                               [name]="'price-' + config.categoryId + '-' + ti"
                               class="w-28 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 rounded
                                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- Save Button -->
        <div class="flex items-center justify-end gap-3">
          <button (click)="resetConfigs()"
                  class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900
                         dark:hover:text-white cursor-pointer">
            Restablecer
          </button>
          <button (click)="saveAll()"
                  [disabled]="isSaving()"
                  class="px-6 py-2 bg-amber-600 text-white font-medium rounded-lg
                         hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors cursor-pointer">
            @if (isSaving()) {
              Guardando...
            } @else {
              💾 Guardar todos los cambios
            }
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ShippingConfigComponent implements OnInit {
  private adminApi = inject(AdminApiService);
  private shippingService = inject(ShippingService);

  protected configs = signal<ShippingConfig[]>([]);
  protected isSaving = signal(false);
  protected saveSuccess = signal(false);
  protected saveError = signal('');

  ngOnInit(): void {
    this.loadConfigs();
  }

  private async loadConfigs(): Promise<void> {
    try {
      // Try loading from API first (editable)
      const apiConfig = await this.adminApi.getShippingConfig();
      this.configs.set(apiConfig.categories);
    } catch {
      // Fallback to local service (read-only)
      this.configs.set(this.shippingService.getAllConfigs());
    }
  }

  async saveAll(): Promise<void> {
    this.isSaving.set(true);
    this.saveSuccess.set(false);
    this.saveError.set('');

    try {
      await this.adminApi.updateShippingConfig({
        categories: this.configs(),
      });
      this.saveSuccess.set(true);
      setTimeout(() => this.saveSuccess.set(false), 3000);
    } catch (err) {
      this.saveError.set(`Error al guardar: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      this.isSaving.set(false);
    }
  }

  resetConfigs(): void {
    this.configs.set(this.shippingService.getAllConfigs());
    this.saveSuccess.set(false);
    this.saveError.set('');
  }

  protected formatCurrency = formatCurrency;
}
