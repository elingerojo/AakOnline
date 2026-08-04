import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RatingStarsComponent } from '../rating-stars/rating-stars.component';
import { QuickActionsComponent } from '../quick-actions/quick-actions.component';
import { formatCurrency } from '../../core/utils/text-utils';
import type { Product } from '@shared/models/product.model';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, RatingStarsComponent, QuickActionsComponent],
  template: `
    <div class="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700">
      <!-- Image -->
      <div class="relative overflow-hidden aspect-square">
        <a [routerLink]="['/product', product().slug]">
          <img
            [src]="product().featuredImage || product().image"
            [alt]="product().name ?? 'Producto'"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </a>

        <!-- Badges: Tags del producto (independientes de la sección) -->
        @if (product().tags.length > 0) {
          <div class="absolute top-3 left-3 z-10 flex flex-col gap-1.5 items-start">
            @for (tag of product().tags; track tag) {
              <span [class]="tagClass(tag)"
                    class="px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide">
                {{ tag }}
              </span>
            }
          </div>
        }

        <!-- Quick actions overlay (opacity + slide up from behind text) -->
        <div class="absolute z-20 right-3 bottom-3 opacity-0 translate-y-5 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
          <app-quick-actions [product]="product()" />
        </div>
      </div>

      <!-- Info -->
      <div class="p-4 md:p-5">
        <a [routerLink]="['/product', product().slug]">
          <h3 class="text-sm md:text-base font-semibold text-gray-900 dark:text-white line-clamp-2 hover:text-primary dark:hover:text-primary transition-colors">
            {{ product().name ?? 'Producto sin nombre' }}
          </h3>
        </a>

        <div class="mt-1.5">
          <app-rating-stars [score]="product().score" [ratings]="product().ratings" />
        </div>

        <div class="mt-2.5 flex items-center gap-2 flex-wrap">
          @if (product().originalPrice > product().currentPrice) {
            <span class="text-sm text-gray-400 line-through">{{ formatCurrency(product().originalPrice) }}</span>
          }
          <span class="text-lg font-bold text-primary dark:text-primary">
            {{ product().currentPrice > 0 ? formatCurrency(product().currentPrice) : 'Consultar' }}
          </span>
        </div>
      </div>
    </div>
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  protected readonly formatCurrency = formatCurrency;

  /** Estilo del badge según el tag (verde para "nuevo", rojo para descuentos/ofertas, gris por defecto). */
  protected tagClass(tag: string): string {
    if (tag === 'nuevo') return 'bg-moss-green text-white';
    if (/^-?\d+%$/.test(tag) || /oferta|descuento/i.test(tag)) return 'bg-red-500 text-white';
    return 'bg-gray-500 text-white';
  }
}
