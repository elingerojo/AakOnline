import { Component, computed, HostListener, inject, input, output, signal } from '@angular/core';
import type { Product } from '@shared/models/product.model';
import type { Category } from '@shared/models/category.model';
import { MarkdownService } from '../../core/services/markdown.service';
import { ImageGalleryComponent } from '../../shared/image-gallery/image-gallery.component';
import { RatingStarsComponent } from '../../shared/rating-stars/rating-stars.component';
import { VariantSelectorComponent, type VariantSelectionResult } from '../../shared/variant-selector/variant-selector.component';
import { formatCurrency } from '../../core/utils/text-utils';

type FieldKey =
  | 'name'
  | 'image'
  | 'imageList'
  | 'currentPrice'
  | 'originalPrice'
  | 'shortDescription'
  | 'longDescription'
  | 'marketingPhrase'
  | 'shippingComponents'
  | 'variantSelections'
  | 'featuredImage'
  | 'featureTag';

type FieldStatus = 'empty' | 'gemini' | 'normal';

const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Nombre',
  image: 'Imagen principal',
  imageList: 'Galería',
  currentPrice: 'Precio actual',
  originalPrice: 'Precio original',
  shortDescription: 'Descripción corta',
  longDescription: 'Descripción larga',
  marketingPhrase: 'Frase de marketing',
  shippingComponents: 'Datos de embarque',
  variantSelections: 'Variantes',
  featuredImage: 'Imagen destacada',
  featureTag: 'Etiqueta de oferta',
};

/**
 * Vista previa (modal a pantalla completa) que renderiza el producto tal como lo
 * verá el visitante, pero construido a partir del formState NO guardado del admin.
 *
 * Sirve como recordatorio de completitud:
 *  - Ámbar (dashed): campos vacíos / sin completar.
 *  - Azul  (dashed): campos llenados por Gemini que el admin aún no ha tocado.
 *  - Sin marco: campo completado y/o revisado.
 *
 * Es 100% presentacional: no escribe en Neon ni en ProductService.
 */
@Component({
  selector: 'app-product-preview',
  standalone: true,
  imports: [ImageGalleryComponent, RatingStarsComponent, VariantSelectorComponent],
  template: `
    <div class="fixed inset-0 z-50 bg-gray-100 dark:bg-gray-900 flex flex-col">
      <!-- Header -->
      <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">Vista previa del producto</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">Así lo verá el visitante. Nada se ha guardado todavía.</p>
        </div>
        <button type="button" (click)="close.emit()"
                class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
          ✕ Cerrar
        </button>
      </header>

      <!-- Summary: completitud + pendientes Gemini -->
      <div class="px-4 py-3 shrink-0 space-y-2">
        @if (summary().empty.length > 0) {
          <div class="p-3 rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-200">
            ⚠️ <strong>Por completar ({{ summary().empty.length }}):</strong> {{ summary().empty.join(', ') }}
          </div>
        }
        @if (summary().gemini.length > 0) {
          <div class="p-3 rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-200">
            💙 <strong>Generado por Gemini, sin revisar ({{ summary().gemini.length }}):</strong> {{ summary().gemini.join(', ') }}
          </div>
        }
        @if (summary().allComplete) {
          <div class="p-3 rounded-lg border border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20 text-sm text-green-800 dark:text-green-200">
            ✅ Toda la información está completa y revisada.
          </div>
        }
      </div>

      <!-- Body (scrollable) -->
      <div class="flex-1 overflow-y-auto">
        <main class="max-w-7xl mx-auto px-4 py-8">
          @if (product(); as prod) {
            <!-- Breadcrumb -->
            <nav class="text-sm mb-6 text-gray-500 dark:text-gray-400">
              <span>Inicio</span>
              <span class="mx-2">/</span>
              <span>{{ category()?.name ?? 'Categoría' }}</span>
              <span class="mx-2">/</span>
              <span class="text-gray-900 dark:text-white">{{ prod.name || 'Sin nombre' }}</span>
            </nav>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <!-- Gallery (imagen principal + galería) -->
              <div class="mb-4 lg:mb-0">
                <div [class]="frameClass(galleryStatus())">
                  @if (galleryStatus() !== 'normal') {
                    <span [class]="badgeClass(galleryStatus())"
                          class="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-xs font-medium">
                      {{ badgeText(galleryStatus(), 'Imagen') }}
                    </span>
                  }
                  <app-image-gallery [images]="allImages()" />
                </div>
              </div>

              <!-- Info -->
              <div>
                <!-- Nombre -->
                <div class="mb-4">
                  <div [class]="frameClass(status('name'))">
                    @if (status('name') !== 'normal') {
                      <span [class]="badgeClass(status('name'))"
                            class="inline-block mb-1 px-2 py-0.5 rounded-full text-xs font-medium">
                        {{ badgeText(status('name'), 'Nombre') }}
                      </span>
                    }
                    <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                      {{ prod.name || '— Sin nombre —' }}
                    </h1>
                  </div>
                </div>

                <div class="mb-4 ml-1">
                  <app-rating-stars [score]="prod.score" [ratings]="prod.ratings" />
                </div>

                <!-- Precio -->
                <div class="mb-4">
                  <div [class]="frameClass(priceStatus())">
                    @if (priceStatus() !== 'normal') {
                      <span [class]="badgeClass(priceStatus())"
                            class="inline-block mb-1 px-2 py-0.5 rounded-full text-xs font-medium">
                        {{ badgeText(priceStatus(), 'Precio') }}
                      </span>
                    }
                    <div class="flex items-center gap-3">
                      @if (prod.originalPrice > prod.currentPrice) {
                        <span class="text-xl text-gray-400 line-through">{{ formatCurrency(prod.originalPrice) }}</span>
                      }
                      <span class="text-3xl font-bold text-amber-600 dark:text-amber-400">
                        {{ prod.currentPrice > 0 ? formatCurrency(prod.currentPrice) : 'Precio no disponible' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Descripción corta -->
                <div class="mb-4">
                  <div [class]="frameClass(status('shortDescription'))">
                    @if (status('shortDescription') !== 'normal') {
                      <span [class]="badgeClass(status('shortDescription'))"
                            class="inline-block mb-1 px-2 py-0.5 rounded-full text-xs font-medium">
                        {{ badgeText(status('shortDescription'), 'Descripción') }}
                      </span>
                    }
                    @if (prod.shortDescription) {
                      <p class="text-gray-600 dark:text-gray-300 leading-relaxed">{{ prod.shortDescription }}</p>
                    } @else {
                      <p class="text-gray-400 italic">Sin descripción corta.</p>
                    }
                  </div>
                </div>

                <!-- Variantes -->
                @if ((category()?.variants?.length ?? 0) > 0) {
                  <div class="mb-4">
                    <div [class]="frameClass(status('variantSelections'))">
                      @if (status('variantSelections') !== 'normal') {
                        <span [class]="badgeClass(status('variantSelections'))"
                              class="inline-block mb-1 px-2 py-0.5 rounded-full text-xs font-medium">
                          {{ badgeText(status('variantSelections'), 'Variantes') }}
                        </span>
                      }
                      <app-variant-selector
                        [variants]="category()?.variants ?? []"
                        [enabledIndices]="prod.variantSelections ?? []"
                        [(selections)]="previewSelections"
                      />
                    </div>
                  </div>
                }

                <!-- Datos de embarque -->
                <div class="mb-4">
                  <div [class]="frameClass(status('shippingComponents'))">
                    @if (status('shippingComponents') !== 'normal') {
                      <span [class]="badgeClass(status('shippingComponents'))"
                            class="inline-block mb-1 px-2 py-0.5 rounded-full text-xs font-medium">
                        {{ badgeText(status('shippingComponents'), 'Envío') }}
                      </span>
                    }
                    @if ((prod.shippingComponents?.length ?? 0) > 0) {
                      <p class="text-sm text-gray-600 dark:text-gray-300">
                        📦 {{ prod.shippingComponents!.length }} componente(s) de embarque configurado(s).
                      </p>
                    } @else {
                      <p class="text-sm text-gray-400 italic">Sin datos de embarque configurados.</p>
                    }
                  </div>
                </div>

                <!-- SKU & estado -->
                <div class="text-xs text-gray-400 dark:text-gray-500 space-y-1">
                  <p>SKU: {{ prod.sku }}</p>
                  <p>Estado: {{ statusLabel(prod.status) }}</p>
                </div>
              </div>
            </div>

            <!-- Descripción larga (Markdown) -->
            <section class="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <div [class]="frameClass(status('longDescription'))">
                @if (status('longDescription') !== 'normal') {
                  <span [class]="badgeClass(status('longDescription'))"
                        class="inline-block mb-1 px-2 py-0.5 rounded-full text-xs font-medium">
                    {{ badgeText(status('longDescription'), 'Descripción') }}
                  </span>
                }
                <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Descripción</h2>
                @if (prod.longDescription) {
                  <div class="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300"
                       [innerHTML]="markdownToHtml(prod.longDescription)"></div>
                } @else {
                  <p class="text-gray-400 italic">Sin descripción larga.</p>
                }
              </div>
            </section>

            <!-- Producto destacado (solo si tiene tag) -->
            @if (prod.taggedSection) {
              <section class="mt-8 p-3">
                <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-3">🏆 Producto destacado</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div [class]="frameClass(status('featuredImage'))">
                      @if (status('featuredImage') !== 'normal') {
                        <span [class]="badgeClass(status('featuredImage'))"
                              class="inline-block mb-1 px-2 py-0.5 rounded-full text-xs font-medium">
                          {{ badgeText(status('featuredImage'), 'Imagen') }}
                        </span>
                      }
                      @if (featuredImage()) {
                        <img [src]="featuredImage()" alt="Imagen destacada"
                             class="w-40 h-40 object-cover rounded-lg border border-gray-300 dark:border-gray-600" />
                      } @else {
                        <p class="text-sm text-gray-400 italic">Sin imagen destacada.</p>
                      }
                    </div>
                  </div>
                  <div>
                    <div [class]="frameClass(status('featureTag'))">
                      @if (status('featureTag') !== 'normal') {
                        <span [class]="badgeClass(status('featureTag'))"
                              class="inline-block mb-1 px-2 py-0.5 rounded-full text-xs font-medium">
                          {{ badgeText(status('featureTag'), 'Etiqueta') }}
                        </span>
                      }
                      @if (prod.featureTag) {
                        <span class="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium">
                          {{ prod.featureTag }}
                        </span>
                      } @else {
                        <p class="text-sm text-gray-400 italic">Sin etiqueta de oferta.</p>
                      }
                    </div>
                  </div>
                </div>
              </section>
            }
          }
        </main>
      </div>

      <!-- Footer -->
      <footer class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-end gap-3 shrink-0">
        <button type="button" (click)="close.emit()"
                class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer">
          Continuar editando
        </button>
        <button type="button" (click)="save.emit()" [disabled]="saveDisabled()"
                class="px-6 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
          @if (isSaving()) {
            Guardando...
          } @else if (saveDisabled()) {
            🚫 Edita campos para guardar
          } @else {
            {{ saveLabel() }}
          }
        </button>
      </footer>
    </div>
  `,
})
export class ProductPreviewComponent {
  readonly product = input.required<Product>();
  readonly category = input<Category | null>(null);
  readonly geminiFields = input<string[]>([]);
  readonly saveLabel = input('Guardar');
  readonly saveDisabled = input(false);
  readonly isSaving = input(false);

  readonly close = output<void>();
  readonly save = output<void>();

  protected readonly formatCurrency = formatCurrency;
  private markdownService = inject(MarkdownService);

  protected previewSelections = signal<VariantSelectionResult[]>([]);

  protected allImages = computed(() => {
    const p = this.product();
    return [p.image, ...(p.imageList ?? [])].filter(Boolean);
  });

  protected featuredImage = computed(() => {
    const p = this.product();
    return p.featuredImage || p.image || '';
  });

  /** Resumen de pendientes para el banner superior. */
  protected summary = computed(() => {
    const empty: string[] = [];
    const gemini: string[] = [];
    (Object.keys(FIELD_LABELS) as FieldKey[]).forEach(field => {
      const s = this.status(field);
      if (s === 'empty') empty.push(FIELD_LABELS[field]);
      else if (s === 'gemini') gemini.push(FIELD_LABELS[field]);
    });
    return { empty, gemini, allComplete: empty.length === 0 && gemini.length === 0 };
  });

  // ── Estado de cada región ──────────────────────────────────────────────────

  /** La galería (imagen principal + lista) se considera incompleta si falta cualquiera. */
  protected galleryStatus(): FieldStatus {
    if (this.isEmpty('image') || this.isEmpty('imageList')) return 'empty';
    if (this.geminiFields().includes('image')) return 'gemini';
    return 'normal';
  }

  /** El precio se considera incompleto si el actual o el original no son > 0. */
  protected priceStatus(): FieldStatus {
    const p = this.product();
    if (!(p.currentPrice > 0) || !(p.originalPrice > 0)) return 'empty';
    return 'normal';
  }

  protected status(field: FieldKey): FieldStatus {
    if (this.isEmpty(field)) return 'empty';
    if (this.geminiFields().includes(field)) return 'gemini';
    return 'normal';
  }

  // ── Helpers de completitud ─────────────────────────────────────────────────

  private isBlank(value: string | null | undefined): boolean {
    return value == null || value.trim() === '';
  }

  private isEmpty(field: FieldKey): boolean {
    const p = this.product();
    switch (field) {
      case 'name':
        return this.isBlank(p.name);
      case 'image':
        return this.isBlank(p.image);
      case 'imageList':
        return !p.imageList || p.imageList.length === 0;
      case 'currentPrice':
        return !(p.currentPrice > 0);
      case 'originalPrice':
        return !(p.originalPrice > 0);
      case 'shortDescription':
        return this.isBlank(p.shortDescription);
      case 'longDescription':
        return this.isBlank(p.longDescription);
      case 'marketingPhrase':
        return this.isBlank(p.marketingPhrase);
      case 'shippingComponents':
        return !p.shippingComponents || p.shippingComponents.length === 0;
      case 'variantSelections':
        // Solo relevante si la categoría define variantes.
        return (this.category()?.variants?.length ?? 0) > 0 &&
          (!p.variantSelections || p.variantSelections.length === 0);
      case 'featuredImage':
        return !!p.taggedSection && this.isBlank(p.featuredImage);
      case 'featureTag':
        return !!p.taggedSection && this.isBlank(p.featureTag);
      default:
        return false;
    }
  }

  // ── Estilos de resaltado ───────────────────────────────────────────────────

  protected frameClass(status: FieldStatus): string {
    const base = 'relative p-3 rounded-xl border-2 transition-colors ';
    switch (status) {
      case 'empty':
        return base + 'border-dashed border-amber-400 bg-amber-50/40 dark:bg-amber-900/10';
      case 'gemini':
        return base + 'border-dashed border-blue-400 bg-blue-50/40 dark:bg-blue-900/10';
      default:
        return base + 'border-transparent';
    }
  }

  protected badgeClass(status: FieldStatus): string {
    return status === 'empty'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  }

  protected badgeText(status: FieldStatus, label: string): string {
    return status === 'empty' ? `⛔ ${label} pendiente` : `🤖 Gemini: ${label}`;
  }

  // ── Varios ─────────────────────────────────────────────────────────────────

  markdownToHtml(md: string): string {
    return this.markdownService.toHtml(md);
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      activo: 'Activo',
      suspendido: 'Suspendido',
      almacenado: 'Almacenado',
    };
    return labels[status] ?? status;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
