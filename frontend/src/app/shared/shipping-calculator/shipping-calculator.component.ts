import { Component, inject, input, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ShippingService } from '../../core/services/shipping.service';
import { formatCurrency } from '../../core/utils/text-utils';

@Component({
  selector: 'app-shipping-calculator',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Calcular costo de envio</h3>

      <div class="space-y-3">
        <!-- Distance input -->
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Distancia (km)
          </label>
          <input
            type="number"
            [(ngModel)]="distanceKm"
            (input)="calculate()"
            min="0"
            max="5000"
            placeholder="Ej: 150"
            class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
          />
        </div>

        <!-- Units -->
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Unidades
          </label>
          <input
            type="number"
            [(ngModel)]="units"
            (input)="calculate()"
            min="1"
            max="99"
            class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
          />
        </div>

        <!-- Calculate button -->
        <button
          (click)="calculate()"
          class="w-full px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg
                 hover:bg-amber-700 transition-colors cursor-pointer"
        >
          Calcular envio
        </button>

        <!-- Result -->
        @if (estimatedCost() !== null) {
          <div class="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p class="text-xs text-gray-500 dark:text-gray-400">Costo estimado de envio:</p>
            <p class="text-lg font-bold text-amber-600 dark:text-amber-400">
              {{ formatCurrency(estimatedCost()!) }}
            </p>
          </div>
        }

        @if (errorMessage()) {
          <p class="text-xs text-red-500">{{ errorMessage() }}</p>
        }
      </div>
    </div>
  `,
})
export class ShippingCalculatorComponent {
  private shippingService = inject(ShippingService);

  readonly categoryId = input.required<number>();
  readonly onCostCalculated = input<(cost: number) => void>();

  protected distanceKm = signal<number>(0);
  protected units = signal<number>(1);
  protected estimatedCost = signal<number | null>(null);
  protected errorMessage = signal<string>('');

  calculate(): void {
    const dist = this.distanceKm();
    const unitCount = this.units();

    if (dist <= 0) {
      this.errorMessage.set('Ingrese una distancia valida mayor a 0 km.');
      this.estimatedCost.set(null);
      return;
    }

    this.errorMessage.set('');
    const cost = this.shippingService.calculateShippingCost(
      this.categoryId(),
      dist,
      unitCount
    );
    this.estimatedCost.set(cost);

    const callback = this.onCostCalculated();
    if (callback) {
      callback(cost);
    }
  }

  protected formatCurrency = formatCurrency;
}
