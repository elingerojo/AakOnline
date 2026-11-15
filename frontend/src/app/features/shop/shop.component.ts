import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { SeoService } from '../../core/services/seo.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import * as AOS from 'aos';
import { ProductService } from '../../core/services/product.service';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { ScrollToTopComponent } from '../../shared/scroll-to-top/scroll-to-top.component';
import { ContactBarComponent } from '../../shared/contact-bar/contact-bar.component';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [
    ProductCardComponent,
    NavbarComponent,
    FooterComponent,
    ScrollToTopComponent,
    ContactBarComponent,
  ],
  template: `
    <app-navbar />
    <app-contact-bar />

    <main class="min-h-screen bg-white dark:bg-gray-900">
      <!-- Header -->
      <section class="bg-gradient-to-r from-amber-50 to-orange-100 dark:from-gray-800 dark:to-gray-700 py-12">
        <div class="max-w-7xl mx-auto px-4">
          <h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white" data-aos="fade-up">
            Tienda
          </h1>
          <p class="text-gray-600 dark:text-gray-300 mt-2" data-aos="fade-up" data-aos-delay="100">
            Explora nuestra coleccion de muebles artesanales
          </p>

          <!-- Buscador -->
          <div class="mt-6 max-w-md" data-aos="fade-up" data-aos-delay="150">
            <input
              type="search"
              [value]="searchTerm()"
              (input)="onSearchInput($event)"
              placeholder="Buscar productos..."
              aria-label="Buscar productos"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                     placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </section>

      <!-- Products Grid -->
      <section class="py-12">
        <div class="max-w-7xl mx-auto px-4">
          @if (products().length === 0) {
            <div class="text-center py-20">
              <p class="text-gray-500 dark:text-gray-400">No hay productos disponibles en este momento.</p>
            </div>
          } @else {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              @for (product of products(); track product.id) {
                <app-product-card [product]="product" data-aos="fade-up" />
              }
            </div>
          }
        </div>
      </section>
    </main>

    <app-footer />
    <app-scroll-to-top />
  `,
})
export class ShopComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private seoService = inject(SeoService);
  private analytics = inject(AnalyticsService);

  protected readonly searchTerm = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  /** Catálogo filtrado por el buscador (nombre o etiquetas). */
  protected readonly products = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const all = this.productService.publicProducts();
    if (!term) return all;

    return all.filter(
      (product) =>
        (product.name ?? '').toLowerCase().includes(term) ||
        (product.tags ?? []).some((tag) => String(tag).toLowerCase().includes(term))
    );
  });

  ngOnInit(): void {
    AOS.init({ delay: 0, duration: 600, easing: 'ease-out', once: true });
    this.seoService.setPageSeo({
      title: 'Tienda — AakBejuco',
      description: 'Explore nuestra colección completa de muebles artesanales mexicanos hechos a mano.',
    });
  }

  ngOnDestroy(): void {
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = null;
  }

  /**
   * Registra la búsqueda solo si tiene 3+ caracteres y se trunca a 50.
   * Con debounce para no enviar un evento por tecla.
   */
  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.searchTerm.set(value);

    if (this.searchTimer !== null) clearTimeout(this.searchTimer);

    const term = value.trim();
    if (term.length < 3) return;

    this.searchTimer = setTimeout(() => {
      this.analytics.track('search', {
        path: '/shop',
        meta: { q: term.slice(0, 50) },
      });
    }, 800);
  }
}
