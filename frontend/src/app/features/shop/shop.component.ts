import { Component, inject, OnInit } from '@angular/core';
import { SeoService } from '../../core/services/seo.service';
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
export class ShopComponent implements OnInit {
  private productService = inject(ProductService);
  private seoService = inject(SeoService);
  protected products = this.productService.products;

  ngOnInit(): void {
    AOS.init({ delay: 0, duration: 600, easing: 'ease-out', once: true });
    this.seoService.setPageSeo({
      title: 'Tienda — Aak Artesanías',
      description: 'Explore nuestra colección completa de muebles artesanales mexicanos hechos a mano.',
    });
  }
}
