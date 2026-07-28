import { Component, inject, computed, OnInit } from '@angular/core';
import { input } from '@angular/core';
import { SeoService } from '../../core/services/seo.service';
import { CategoryService } from '../../core/services/category.service';
import { ProductService } from '../../core/services/product.service';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { ScrollToTopComponent } from '../../shared/scroll-to-top/scroll-to-top.component';
import { ContactBarComponent } from '../../shared/contact-bar/contact-bar.component';

@Component({
  selector: 'app-category',
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
      <!-- Category Header -->
      <section
        class="relative py-20 bg-cover bg-center"
        [style.background-image]="'url(' + (category()?.bgImage ?? '') + ')'"
      >
        <div class="absolute inset-0 bg-black/50"></div>
        <div class="relative max-w-7xl mx-auto px-4 text-center">
          <h1 class="text-3xl md:text-4xl font-bold text-white">
            {{ category()?.name ?? 'Categoria' }}
          </h1>
          <p class="text-white/80 mt-2">
            {{ productCount() }} {{ productCount() === 1 ? 'modelo' : 'modelos' }} disponibles
          </p>
        </div>
      </section>

      <!-- Products -->
      <section class="py-12">
        <div class="max-w-7xl mx-auto px-4">
          @if (products().length === 0) {
            <div class="text-center py-20">
              <p class="text-gray-500 dark:text-gray-400">No hay productos en esta categoria.</p>
            </div>
          } @else {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              @for (product of products(); track product.id) {
                <app-product-card [product]="product" />
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
export class CategoryComponent implements OnInit {
  private categoryService = inject(CategoryService);
  private productService = inject(ProductService);
  private seoService = inject(SeoService);

  /** Route param 'slug' auto-bound via withComponentInputBinding */
  protected readonly slug = input('', { alias: 'slug' });

  protected category = computed(() => {
    const slug = this.slug();
    if (!slug) return undefined;
    return this.categoryService.getBySlug(slug);
  });

  protected products = computed(() => {
    const cat = this.category();
    if (!cat) return [];
    return this.productService.getByCategoryId(cat.id);
  });

  protected productCount = computed(() => this.products().length);

  ngOnInit(): void {
    const cat = this.category();
    if (cat) {
      this.seoService.setPageSeo({
        title: `${cat.name} — Aak Artesanías`,
        description: `Explore nuestra colección de ${cat.name} artesanales hechos a mano. ${cat.models} modelos disponibles.`,
      });
    }
  }
}
