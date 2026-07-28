import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as AOS from 'aos';
import { QuoteService } from '../../core/services/quote.service';
import { SeoService } from '../../core/services/seo.service';
import { PdfService } from '../../core/services/pdf.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { ScrollToTopComponent } from '../../shared/scroll-to-top/scroll-to-top.component';
import { ContactBarComponent } from '../../shared/contact-bar/contact-bar.component';
import { IncDecComponent } from '../../shared/inc-dec/inc-dec.component';
import { formatCurrency } from '../../core/utils/text-utils';

@Component({
  selector: 'app-quote',
  standalone: true,
  imports: [
    RouterLink,
    NavbarComponent,
    FooterComponent,
    ScrollToTopComponent,
    ContactBarComponent,
    IncDecComponent,
  ],
  template: `
    <app-navbar />
    <app-contact-bar />

    <main class="min-h-screen bg-white dark:bg-gray-900 pb-20 lg:pb-0">
      <div class="max-w-7xl mx-auto px-4 py-8">
        <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-8" data-aos="fade-up">
          Cotizacion
        </h1>

        @if (quoteService.items().length === 0) {
          <div class="text-center py-20" data-aos="fade-up">
            <p class="text-gray-500 dark:text-gray-400 mb-4">No hay productos en tu cotizacion.</p>
            <a routerLink="/shop" class="text-amber-600 hover:underline">Explorar catalogo</a>
          </div>
        } @else {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Items List -->
            <div class="lg:col-span-2 space-y-4" data-aos="fade-right">
              @for (item of quoteService.items(); track item.productId; let i = $index) {
                <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div class="flex gap-4">
                    <img [src]="item.image" [alt]="item.productName"
                         class="w-20 h-20 object-cover rounded-lg flex-shrink-0" loading="lazy" />
                    <div class="flex-1 min-w-0">
                      <h3 class="font-semibold text-gray-900 dark:text-white">{{ item.productName }}</h3>
                      
                      <!-- Selected variants -->
                      @if (item.selectedVariants.length > 0) {
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          @for (v of item.selectedVariants; track v.variantLabel) {
                            <span class="mr-3">{{ v.variantLabel }}: {{ v.optionName }}</span>
                          }
                        </div>
                      }

                      <div class="flex items-center justify-between mt-2">
                        <app-inc-dec [value]="item.qty" (changed)="updateQty(item.productId, $event)" />
                        <div class="text-right">
                          <p class="text-sm text-gray-500 dark:text-gray-400">
                            {{ formatCurrency(item.unitPrice) }} c/u
                          </p>
                          <p class="font-semibold text-gray-900 dark:text-white">
                            {{ formatCurrency(item.subtotal) }}
                          </p>
                        </div>
                      </div>

                      <button
                        (click)="removeItem(item.productId)"
                        class="mt-2 text-xs text-red-500 hover:text-red-600 cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>

            <!-- Summary Sidebar -->
            <div class="lg:sticky lg:top-24 h-fit" data-aos="fade-left">
              <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Resumen</h2>

                <div class="space-y-3 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Subtotal</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(quoteService.subtotal()) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">IVA (16%)</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(quoteService.iva()) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Envio</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(quoteService.totalShipping()) }}</span>
                  </div>
                  <hr class="border-gray-300 dark:border-gray-600" />
                  <div class="flex justify-between text-base">
                    <span class="font-bold text-gray-900 dark:text-white">Total</span>
                    <span class="font-bold text-amber-600 dark:text-amber-400">{{ formatCurrency(quoteService.grandTotal()) }}</span>
                  </div>
                </div>

                <!-- Actions -->
                <div class="mt-6 space-y-3">
                  <button
                    (click)="generatePdf()"
                    [disabled]="isGenerating"
                    class="w-full px-4 py-2.5 bg-amber-600 text-white font-medium rounded-lg
                           hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors cursor-pointer"
                  >
                    {{ isGenerating ? 'Generando...' : 'Descargar PDF' }}
                  </button>

                  <button
                    (click)="previewPdf()"
                    [disabled]="isGenerating"
                    class="w-full px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium
                           rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50
                           dark:hover:bg-gray-600 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    Vista previa
                  </button>

                  <button
                    (click)="clearQuote()"
                    class="w-full px-4 py-2 text-sm text-red-500 hover:text-red-600 cursor-pointer"
                  >
                    Vaciar cotizacion
                  </button>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    </main>

    <app-footer />
    <app-scroll-to-top />
  `,
})
export class QuoteComponent implements OnInit {
  protected quoteService = inject(QuoteService);
  private pdfService = inject(PdfService);
  private seoService = inject(SeoService);

  protected isGenerating = false;
  protected readonly formatCurrency = formatCurrency;

  ngOnInit(): void {
    AOS.init({ delay: 0, duration: 600, easing: 'ease-out', once: true });
    this.seoService.setPageSeo({
      title: 'Cotización — Aak Artesanías',
      description: 'Revise y descargue su cotización de muebles artesanales mexicanos.',
    });
  }

  updateQty(productId: number, qty: number): void {
    this.quoteService.updateQuantity(productId, qty);
  }

  removeItem(productId: number): void {
    this.quoteService.removeItem(productId);
  }

  clearQuote(): void {
    this.quoteService.clear();
  }

  async generatePdf(): Promise<void> {
    this.isGenerating = true;
    try {
      const summary = this.quoteService.getSummary();
      await this.pdfService.downloadQuote(summary);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      this.isGenerating = false;
    }
  }

  async previewPdf(): Promise<void> {
    this.isGenerating = true;
    try {
      const summary = this.quoteService.getSummary();
      await this.pdfService.previewQuote(summary);
    } catch (err) {
      console.error('Error previewing PDF:', err);
    } finally {
      this.isGenerating = false;
    }
  }
}
