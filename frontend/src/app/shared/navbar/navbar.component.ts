import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { QuoteService } from '../../core/services/quote.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { CategoryService } from '../../core/services/category.service';
import { ProductService } from '../../core/services/product.service';
import type { Product } from '@shared/models/product.model';
import { ThemeSwitcherComponent } from '../theme-switcher/theme-switcher.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ThemeSwitcherComponent],
  template: `
    <nav class="header-area sticky top-0 z-50 w-full"
         [class.sticky-header]="isScrolled()"
         [class.bg-white]="!isScrolled()"
         [class.dark:bg-gray-900]="!isScrolled()">
      <div class="container-fluid">
        <div class="flex items-center justify-between gap-x-2 sm:gap-x-6 max-w-[1720px] mx-auto relative py-[10px] sm:py-4 lg:py-0">

          <!-- Logo -->
          <a routerLink="/" class="cursor-pointer block min-w-0" aria-label="Aak Artesanias">
            <img src="assets/img/Logo_mini_Aak_para-App-02.png" alt="Aak" class="w-[100px] sm:w-[200px]" />
          </a>

          <!-- Desktop Nav -->
          <div class="main-menu absolute z-50 w-full lg:w-auto top-full left-0 lg:static
                      bg-white dark:bg-gray-900 lg:bg-transparent lg:dark:bg-transparent
                      px-5 sm:px-[20px] py-[10px] sm:py-5 lg:px-0 lg:py-0"
               [class.active]="isMobileMenuOpen()">

            <ul class="text-lg leading-none text-title dark:text-white lg:flex lg:gap-[30px]">
              <!-- Inicio -->
              <li>
                <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}"
                   (click)="closeMobileMenu()">
                  Inicio<span></span>
                </a>
              </li>

              <!-- Productos con sub-menu (solo toggle, sin navegación) -->
              <li class="relative nav-with-submenu" [class.active]="isSubmenuOpen()">
                <a href="javascript:void(0)" (click)="$event.preventDefault(); toggleSubmenu()">
                  Productos<span></span>
                </a>
                <ul class="sub-menu lg:absolute z-50 lg:top-full lg:left-0 lg:min-w-[220px]
                           lg:bg-white lg:dark:bg-gray-900 lg:py-[15px] lg:pr-[30px]">
                  @for (cat of categories(); track cat.id) {
                    <li>
                      <a [routerLink]="['/category', cat.slug]" (click)="closeMobileMenu()"
                         class="capitalize">
                        {{ cat.name }}
                      </a>
                    </li>
                  }
                </ul>
              </li>

              <!-- Envíos -->
              <li>
                <a routerLink="/shipping" routerLinkActive="active"
                   (click)="closeMobileMenu()">
                  Env&iacute;os<span></span>
                </a>
              </li>

              <!-- Cotización -->
              <li>
                <a routerLink="/quote" routerLinkActive="active"
                   (click)="closeMobileMenu()">
                  Cotizaci&oacute;n<span></span>
                </a>
              </li>

              <!-- Admin (solo móvil) -->
              <li class="lg:hidden">
                <a routerLink="/admin" (click)="closeMobileMenu()">
                  Admin<span></span>
                </a>
              </li>
            </ul>
          </div>

          <!-- Right Actions -->
          <div class="flex items-center gap-2 shrink-0">
            <app-theme-switcher />

            <!-- Wishlist -->
            <div class="relative">
              <button (click)="toggleWishlistPopup()"
                      class="relative p-2 text-gray-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                      [class.active]="isWishlistOpen()"
                      aria-label="Favoritos">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
                </svg>
                @if (wishlistCount() > 0) {
                  <span class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {{ wishlistCount() }}
                  </span>
                }
              </button>

              <!-- Wishlist popup -->
              @if (isWishlistOpen() && wishlistCount() > 0) {
                <div class="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div class="p-3 border-b border-gray-200 dark:border-gray-700">
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Favoritos ({{ wishlistCount() }})</h4>
                  </div>
                  <div class="max-h-60 overflow-y-auto p-3 space-y-3">
                    @for (item of wishlistItems(); track item.id) {
                      <div class="flex items-center gap-3">
                        <img [src]="item.image" [alt]="item.name ?? ''" class="w-12 h-12 rounded object-cover" loading="lazy" />
                        <div class="flex-1 min-w-0">
                          <a [routerLink]="['/product', item.slug]" (click)="closeWishlistPopup()"
                             class="text-sm font-medium text-gray-900 dark:text-white truncate block hover:text-amber-600">
                            {{ item.name ?? 'Producto' }}
                          </a>
                          @if (item.currentPrice > 0) {
                            <p class="text-xs text-amber-600 font-semibold">{{ formatCurrency(item.currentPrice) }}</p>
                          }
                        </div>
                        <button (click)="removeFromWishlist(item.id)"
                                class="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                                aria-label="Quitar">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    }
                  </div>
                  @if (wishlistCount() > 0) {
                    <div class="p-3 border-t border-gray-200 dark:border-gray-700">
                      <button (click)="clearWishlist()"
                              class="text-xs text-gray-500 hover:text-red-500 transition-colors cursor-pointer">
                        Limpiar lista
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Quote count -->
            <a routerLink="/quote" class="relative p-2 text-gray-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
                <path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd" />
              </svg>
              @if (quoteCount() > 0) {
                <span class="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {{ quoteCount() }}
                </span>
              }
            </a>

            <!-- Hamburger -->
            <button (click)="toggleMobileMenu()"
                    class="hamburger lg:hidden p-2 text-gray-600 dark:text-gray-300"
                    [class.opened]="isMobileMenuOpen()"
                    aria-label="Menu">
              <svg width="30" height="30" viewBox="0 0 100 100">
                <path class="line line1" d="M 20,29.000046 H 80.000231 C 80.000231,29.000046 94.498839,28.817352 94.532987,66.711331 94.543142,77.980673 90.966081,81.670246 85.259173,81.668997 79.552261,81.667751 75.000211,74.999942 75.000211,74.999942 L 25.000021,25.000058" />
                <path class="line line2" d="M 20,50 H 80" />
                <path class="line line3" d="M 20,70.999954 H 80.000231 C 80.000231,70.999954 94.498839,71.182648 94.532987,33.288669 94.543142,22.019327 90.966081,18.329754 85.259173,18.331003 79.552261,18.332249 75.000211,25.000058 75.000211,25.000058 L 25.000021,74.999942" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  `,
})
export class NavbarComponent {
  private quoteService = inject(QuoteService);
  private wishlistService = inject(WishlistService);
  private categoryService = inject(CategoryService);
  private productService = inject(ProductService);

  protected readonly categories = this.categoryService.categories;
  protected readonly quoteCount = this.quoteService.itemCount;
  protected readonly wishlistCount = this.wishlistService.count;
  protected readonly isMobileMenuOpen = signal(false);
  protected readonly isScrolled = signal(false);
  protected readonly isSubmenuOpen = signal(false);
  protected readonly isWishlistOpen = signal(false);

  /** Wishlist items with full product data */
  protected readonly wishlistItems = computed(() => {
    const ids = this.wishlistService.items();
    const allProducts = this.productService.products();
    return ids
      .map(id => allProducts.find(p => p.id === id))
      .filter((p): p is Product => p !== undefined);
  });

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled.set(window.scrollY > 50);
    if (this.isWishlistOpen()) this.isWishlistOpen.set(false);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(v => !v);
    if (this.isMobileMenuOpen()) this.isSubmenuOpen.set(false);
  }

  toggleSubmenu(): void {
    if (window.matchMedia('(max-width: 1024px)').matches) {
      this.isSubmenuOpen.update(v => !v);
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
    this.isSubmenuOpen.set(false);
  }

  toggleWishlistPopup(): void {
    this.isWishlistOpen.update(v => !v);
  }

  closeWishlistPopup(): void {
    this.isWishlistOpen.set(false);
  }

  removeFromWishlist(productId: number): void {
    this.wishlistService.remove(productId);
  }

  clearWishlist(): void {
    this.wishlistService.clear();
    this.isWishlistOpen.set(false);
  }

  protected formatCurrency(value: number): string {
    return '$' + value.toLocaleString('es-MX');
  }
}
