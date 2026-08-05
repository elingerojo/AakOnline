import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import * as AOS from 'aos';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { QuoteService } from '../../core/services/quote.service';
import { SeoService } from '../../core/services/seo.service';
import { MarkdownService } from '../../core/services/markdown.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { ScrollToTopComponent } from '../../shared/scroll-to-top/scroll-to-top.component';
import { ContactBarComponent } from '../../shared/contact-bar/contact-bar.component';
import { ImageGalleryComponent } from '../../shared/image-gallery/image-gallery.component';
import { VariantSelectorComponent, type VariantSelectionResult } from '../../shared/variant-selector/variant-selector.component';
import { ShippingCalculatorComponent } from '../../shared/shipping-calculator/shipping-calculator.component';
import { RatingStarsComponent } from '../../shared/rating-stars/rating-stars.component';
import { IncDecComponent } from '../../shared/inc-dec/inc-dec.component';
import { formatCurrency } from '../../core/utils/text-utils';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    RouterLink,
    NavbarComponent,
    FooterComponent,
    ScrollToTopComponent,
    ContactBarComponent,
    ImageGalleryComponent,
    VariantSelectorComponent,
    ShippingCalculatorComponent,
    RatingStarsComponent,
    IncDecComponent,
  ],
  template: `
    <app-navbar />
    <app-contact-bar />

    <main class="min-h-screen bg-white dark:bg-gray-900">
      @if (product(); as prod) {
        <div class="max-w-7xl mx-auto px-4 py-8">
          <!-- Breadcrumb -->
          <nav class="text-sm breadcrumbs mb-6 text-gray-500 dark:text-gray-400">
            <a routerLink="/" class="hover:text-amber-600">Inicio</a>
            <span class="mx-2">/</span>
            <a [routerLink]="['/category', category()?.slug]" class="hover:text-amber-600">
              {{ category()?.name ?? 'Categoria' }}
            </a>
            <span class="mx-2">/</span>
            <span class="text-gray-900 dark:text-white">{{ prod.name ?? 'Producto' }}</span>
          </nav>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Gallery -->
            <div data-aos="fade-right">
              <app-image-gallery [images]="allImages()" />
            </div>

            <!-- Product Info -->
            <div data-aos="fade-left">
              <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {{ prod.name ?? 'Producto sin nombre' }}
              </h1>

              <div class="mb-4">
                <app-rating-stars [score]="prod.score" [ratings]="prod.ratings" />
              </div>

              <!-- Price -->
              <div class="flex items-center gap-3 mb-6">
                @if (prod.originalPrice > prod.currentPrice) {
                  <span class="text-xl text-gray-400 line-through">{{ formatCurrency(prod.originalPrice) }}</span>
                }
                <span class="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {{ prod.currentPrice > 0 ? formatCurrency(prod.currentPrice) : 'Precio no disponible' }}
                </span>
              </div>

              <!-- Short Description -->
              @if (prod.shortDescription) {
                <p class="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                  {{ prod.shortDescription }}
                </p>
              }

              <!-- Variants -->
              @if (categoryVariants().length > 0) {
                <div class="mb-6">
                  <app-variant-selector
                    [variants]="categoryVariants()"
                    [enabledIndices]="prod.variantSelections"
                    [(selections)]="variantSelections"
                  />
                </div>
              }

              <!-- Quantity + Add to Quote -->
              <div class="flex items-center gap-4 mb-6">
                <app-inc-dec [value]="quantity()" (changed)="quantity.set($event)" />
                <button
                  (click)="addToQuote()"
                  class="px-6 py-2.5 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
                >
                  Agregar a cotizacion
                </button>
              </div>

              <!-- Shipping Calculator -->
              <div class="mb-6">
                <app-shipping-calculator
                  [categoryId]="prod.categoryId"
                  [onCostCalculated]="onShippingCalculated"
                />
              </div>

              <!-- SKU -->
              <div class="text-xs text-gray-400 dark:text-gray-500 space-y-1">
                <p>SKU: {{ prod.sku }}</p>
              </div>
            </div>
          </div>

          <!-- Long Description -->
          @if (prod.longDescription) {
            <section class="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Descripcion</h2>
              <div class="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300"
                   [innerHTML]="markdownToHtml(prod.longDescription)">
              </div>
            </section>
          }
        </div>
      } @else {
        <div class="text-center py-20">
          <p class="text-gray-500 dark:text-gray-400">Producto no encontrado.</p>
          <a routerLink="/shop" class="text-amber-600 hover:underline mt-2 inline-block">Volver a la tienda</a>
        </div>
      }
    </main>

    <app-footer />
    <app-scroll-to-top />
  `,
})
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private quoteService = inject(QuoteService);
  private seoService = inject(SeoService);
  protected markdownService = inject(MarkdownService);

  protected product = computed(() => {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    return this.productService.publicProducts().find(p => p.slug === slug);
  });

  protected category = computed(() => {
    const prod = this.product();
    if (!prod) return undefined;
    return this.categoryService.getById(prod.categoryId);
  });

  protected categoryVariants = computed(() => {
    const cat = this.category();
    return cat?.variants ?? [];
  });

  protected allImages = computed(() => {
    const prod = this.product();
    if (!prod) return [];
    return [prod.image, ...prod.imageList].filter(Boolean);
  });

  protected quantity = signal(1);
  protected variantSelections = signal<VariantSelectionResult[]>([]);
  protected shippingCost = signal(0);

  protected readonly formatCurrency = formatCurrency;
  protected readonly onShippingCalculated = (cost: number) => this.shippingCost.set(cost);

  ngOnInit(): void {
    AOS.init({ delay: 0, duration: 600, easing: 'ease-out', once: true });

    const prod = this.product();
    if (prod) {
      this.seoService.setPageSeo({
        title: `${prod.name ?? 'Producto'} — Aak Artesanías`,
        description: prod.shortDescription || `${prod.name ?? 'Producto artesanal'} hecho a mano en México.`,
        image: prod.image || undefined,
        type: 'product',
      });
    }
  }

  markdownToHtml(md: string): string {
    return this.markdownService.toHtml(md);
  }

  addToQuote(): void {
    const prod = this.product();
    if (!prod || prod.status !== 'activo' || !prod.name || prod.currentPrice <= 0) return;

    const variantPrice = this.variantSelections().reduce((sum, v) => sum + v.optionPrice, 0);
    const unitPrice = Math.max(0, prod.currentPrice + variantPrice);
    const qty = this.quantity();

    this.quoteService.addItem({
      productId: prod.id,
      productName: prod.name,
      image: prod.image,
      selectedVariants: this.variantSelections().map(v => ({
        variantLabel: v.variantLabel,
        optionName: v.selectedOptionName,
        optionPrice: v.optionPrice,
      })),
      qty,
      unitPrice,
      subtotal: unitPrice * qty,
      shippingCost: this.shippingCost(),
    });
  }
}
