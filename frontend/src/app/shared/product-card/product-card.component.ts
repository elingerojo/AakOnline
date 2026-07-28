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

        <!-- Badge: Descuento (rojo) -->
        @if (product().featureTag) {
          <span class="btn-tag absolute top-3 left-3 z-10">
            {{ product().featureTag }}
          </span>
        }

        <!-- Badge: Tag 'nuevo' (verde) -->
        @if (product().tags.includes('nuevo')) {
          <span class="absolute top-3 right-3 z-10 px-3 py-1 text-xs font-bold rounded-full bg-moss-green text-white uppercase tracking-wide">
            Nuevo
          </span>
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
}
