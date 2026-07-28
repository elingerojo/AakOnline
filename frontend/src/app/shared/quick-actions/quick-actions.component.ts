import { Component, inject, input } from '@angular/core';
import { WishlistService } from '../../core/services/wishlist.service';
import { QuoteService } from '../../core/services/quote.service';
import type { Product } from '@shared/models/product.model';

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  template: `
    <div class="flex flex-col items-end gap-3">
      <!-- Wishlist button (big heart) -->
      <button (click)="toggleWishlist()"
              class="bg-white/80 dark:bg-title/80 dark:text-white flex items-center justify-center gap-2
                     px-4 py-[10px] text-base leading-none text-title rounded-[40px] h-14 overflow-hidden
                     transition-all duration-300"
              [attr.aria-label]="isInWishlist ? 'Quitar de favoritos' : 'Agregar a favoritos'">
        @if (isInWishlist) {
          <!-- Solid heart (filled) -->
          <svg xmlns="http://www.w3.org/2000/svg" class="text-red-500 text-[24px]" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span class="mt-1 pb-2 text-sm">Quitar de Favoritos</span>
        } @else {
          <!-- Outline heart -->
          <svg xmlns="http://www.w3.org/2000/svg" class="dark:text-white text-[24px]" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span class="mt-1 pb-2 text-sm">Agregar a Favoritos</span>
        }
      </button>

      <!-- Quote button (shopping bag icon, toggleable like wishlist) -->
      <button (click)="toggleQuote()"
              class="bg-white/80 dark:bg-title/80 dark:text-white flex items-center justify-center gap-2
                     px-4 py-[10px] text-base leading-none text-title rounded-[40px] h-14 overflow-hidden
                     transition-all duration-300"
              [attr.aria-label]="isInQuote ? 'Quitar de cotización' : 'Agregar a cotización'">
        @if (isInQuote) {
          <!-- Filled shopping bag (selected) -->
          <svg xmlns="http://www.w3.org/2000/svg" class="text-amber-500 text-[24px]" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <span class="mt-1 pb-2 text-sm">Quitar de Cotización</span>
        } @else {
          <!-- Outline shopping bag -->
          <svg xmlns="http://www.w3.org/2000/svg" class="dark:text-white text-[24px]" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <span class="mt-1 pb-2 text-sm">Agregar a Cotización</span>
        }
      </button>
    </div>
  `,
})
export class QuickActionsComponent {
  private wishlistService = inject(WishlistService);
  private quoteService = inject(QuoteService);

  readonly product = input.required<Product>();

  get isInWishlist(): boolean {
    const prod = this.product();
    return prod ? this.wishlistService.has(prod.id) : false;
  }

  get isInQuote(): boolean {
    const prod = this.product();
    return prod ? this.quoteService.has(prod.id) : false;
  }

  toggleWishlist(): void {
    const prod = this.product();
    if (prod) {
      this.wishlistService.toggle(prod.id);
    }
  }

  toggleQuote(): void {
    const prod = this.product();
    if (!prod) return;

    if (this.quoteService.has(prod.id)) {
      this.quoteService.removeItem(prod.id);
    } else {
      this.quoteService.addItem({
        productId: prod.id,
        productName: prod.name ?? 'Producto',
        image: prod.image,
        selectedVariants: [],
        qty: 1,
        unitPrice: prod.currentPrice,
        subtotal: prod.currentPrice,
        shippingCost: 0,
      });
    }
  }
}
