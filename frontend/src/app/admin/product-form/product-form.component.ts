import { Component, inject, input, output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ProductService } from '../../core/services/product.service';
import { ProductPreviewComponent } from '../product-preview/product-preview.component';
import type { Product, ProductStatus } from '@shared/models/product.model';
import type { Category } from '@shared/models/category.model';
import { generateSlug, formatCurrency } from '../../core/utils/text-utils';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [FormsModule, ProductPreviewComponent],
  template: `
    <form (ngSubmit)="onSubmit()" (input)="onFormInput($event)" (change)="onFormInput($event)" class="space-y-6">
      <!-- Top actions: Vista previa + Guardar -->
      <div class="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <button type="button" (click)="openPreview()"
                class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                       hover:bg-blue-700 transition-colors cursor-pointer">
          👁️ Vista previa
        </button>
        <button type="submit"
                [disabled]="isSaving() || geminiBlockSave()"
                class="px-6 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg
                       hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors cursor-pointer">
          @if (isSaving()) {
            Guardando...
          } @else if (geminiBlockSave()) {
            🚫 Edita campos para guardar
          } @else {
            {{ editingProduct() ? 'Actualizar' : 'Crear producto' }}
          }
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Basic Info -->
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nombre del producto
          </label>
          @if (suggestedNames().length > 0) {
            <!-- Selector de nombre sugerido por Gemini -->
            <div class="flex gap-2 items-start">
              <select (change)="onNameSelected($event)"
                      class="flex-1 px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg
                             bg-purple-50 dark:bg-purple-900/20 text-gray-900 dark:text-white
                             font-medium">
                <option value="">Seleccionar nombre sugerido...</option>
                @for (name of suggestedNames(); track name) {
                  <option [value]="name" [selected]="formState.name === name">
                    {{ name }}
                  </option>
                }
              </select>
              <button type="button" (click)="suggestedNames.set([])"
                      class="text-xs text-gray-400 hover:text-gray-600 mt-2 cursor-pointer">
                Limpiar
              </button>
            </div>
          }
          <input [(ngModel)]="formState.name" name="name" required
                 class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                        {{ suggestedNames().length > 0 ? 'mt-2' : '' }}" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label>
          <input [(ngModel)]="formState.sku" name="sku" required
                 class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
          <select [(ngModel)]="formState.categoryId" name="categoryId" required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="" disabled>Seleccionar categoria...</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">{{ cat.name }}</option>
            }
          </select>
        </div>

        <!-- Pricing -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Precio actual <span class="text-amber-600 font-bold">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
            <input type="number" [(ngModel)]="formState.currentPrice" name="currentPrice" required
                   (input)="onCurrentPriceChange()"
                   class="w-full pl-8 pr-3 py-2 border-2 border-amber-400 dark:border-amber-500 rounded-lg
                          bg-white dark:bg-gray-700 text-lg font-bold text-gray-900 dark:text-white
                          focus:ring-2 focus:ring-amber-300 focus:border-amber-500" />
          </div>
        </div>

        <div>
          <label class="block text-xs text-gray-400 dark:text-gray-500 mb-1">
            Precio original <span class="italic">(auto, +15% para framing)</span>
          </label>
          <div class="flex gap-2 items-center">
            <div class="flex-1 relative">
              <span class="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
              <input type="number"
                     [value]="calculatedOriginalPrice"
                     [disabled]="!overrideOriginalPrice()"
                     class="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg
                            bg-gray-50 dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-400
                            disabled:opacity-60 disabled:cursor-not-allowed
                            {{ overrideOriginalPrice() ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white' : '' }}"
                     (input)="overrideOriginalPrice() && (formState.originalPrice = $any($event.target).value)" />
            </div>
            <button type="button"
                    (click)="toggleOriginalPrice()"
                    class="px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap
                           {{ overrideOriginalPrice()
                             ? 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                             : 'border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20' }}">
              {{ overrideOriginalPrice() ? 'Auto' : 'Ajustar' }}
            </button>
          </div>
          @if (!overrideOriginalPrice()) {
            <p class="text-xs text-gray-400 mt-1">Se calcula automáticamente. Clic en "Ajustar" para personalizar.</p>
          }
        </div>

        <!-- Status -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
          <select [(ngModel)]="formState.status" name="status"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="pendiente">Pendiente</option>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
            <option value="almacenado">Almacenado</option>
          </select>
        </div>

        <!-- Main Image (for Gemini) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Imagen principal <span class="text-xs text-amber-600">(para Gemini)</span>
          </label>
          <div class="flex flex-col gap-2">
            <input type="file" (change)="onMainFileSelected($event)"
                   accept="image/jpeg,image/png,image/webp"
                   class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0 file:text-sm file:font-medium
                          file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100
                          dark:file:bg-gray-700 dark:file:text-gray-300" />
            @if (isUploading()) {
              <span class="text-sm text-gray-500">Subiendo imagen...</span>
            }
            @if (uploadError()) {
              <span class="text-sm text-red-500">{{ uploadError() }}</span>
            }
          </div>
          @if (formState.image) {
            <img [src]="formState.image" alt="Preview"
                 class="mt-2 w-32 h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600" />
          }
        </div>

        <!-- Image URL (manual fallback for main image) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            O URL de imagen manual
          </label>
          <input [(ngModel)]="formState.image" name="image"
                 class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>

        <!-- Gallery Images (imageList) -->
        <div class="md:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Imagenes de galeria
          </label>

          <div class="flex items-center gap-3 mb-3">
            <input type="file" (change)="onGalleryFileSelected($event)"
                   accept="image/jpeg,image/png,image/webp"
                   class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0 file:text-sm file:font-medium
                          file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200
                          dark:file:bg-gray-700 dark:file:text-gray-300" />
            @if (isUploadingGallery()) {
              <span class="text-sm text-gray-500">Subiendo...</span>
            }
          </div>

          @if (formState.imageList.length > 0) {
            <div class="flex flex-wrap gap-3">
              @for (img of formState.imageList; track img; let i = $index) {
                <div class="relative group">
                  <img [src]="img" alt="Gallery {{i + 1}}"
                       class="w-20 h-20 object-cover rounded-lg border border-gray-300 dark:border-gray-600" />
                  <button type="button"
                          (click)="removeGalleryImage(i)"
                          class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white
                                 rounded-full text-xs flex items-center justify-center
                                 opacity-0 group-hover:opacity-100 transition-opacity
                                 cursor-pointer hover:bg-red-600">
                    ✕
                  </button>
                </div>
              }
            </div>
          } @else {
            <p class="text-sm text-gray-400">Sin imagenes de galeria adicionales</p>
          }
        </div>

        <!-- Product Highlighting (Featured / New) -->
        <div class="md:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">🏆 Producto Destacado</h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Tags -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                         [checked]="isTagged('destacados')"
                         (change)="toggleTag('destacados')"
                         class="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Destacados</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                         [checked]="isTagged('nuevos')"
                         (change)="toggleTag('nuevos')"
                         class="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                  <span class="text-sm text-gray-700 dark:text-gray-300">Nuevos</span>
                </label>
              </div>
            </div>

            <!-- Featured Image Selector -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Imagen destacada
              </label>
              <select [(ngModel)]="formState.featuredImage" name="featuredImage"
                      [disabled]="!hasTag()"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="">Imagen #1 (principal)</option>
                @for (img of availableImages; track img; let i = $index) {
                  <option [value]="img" [selected]="formState.featuredImage === img">
                    Imagen #{{ i + 2 }}
                  </option>
                }
              </select>
              @if (!hasTag()) {
                <p class="text-xs text-gray-400 mt-1">Selecciona "Destacados" o "Nuevos" para habilitar.</p>
              }
              @if (featuredImagePreview()) {
                <img [src]="featuredImagePreview()" alt="Featured preview"
                     class="mt-2 w-20 h-20 object-cover rounded-lg border border-gray-300 dark:border-gray-600" />
              }
            </div>

            <!-- Feature Tag -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Etiqueta de oferta
              </label>
              <input [(ngModel)]="formState.featureTag" name="featureTag"
                     placeholder="-10%, Envio gratis, etc."
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                            bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>
        </div>

        <!-- Gemini AI Generator -->
        <div class="md:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
          <div class="flex items-center gap-3">
            <button type="button"
                    (click)="generateWithGemini()"
                    [disabled]="isGenerating() || !formState.image"
                    class="px-4 py-2 bg-gradient-to-r from-purple-600 to-amber-500
                           text-white font-medium rounded-lg hover:opacity-90
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all cursor-pointer">
              @if (isGenerating()) {
                ⏳ Generando...
              } @else {
                ✨ Generar con Gemini
              }
            </button>
            @if (isGenerating()) {
              <span class="text-sm text-gray-500">Analizando imagen con IA...</span>
            }
          </div>
          @if (geminiError()) {
            <div class="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                        rounded-lg text-sm text-red-700 dark:text-red-300">
              ⚠️ {{ geminiError() }}
            </div>
          }
        </div>

        <!-- Descriptions -->
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Descripcion corta
          </label>
          <textarea [(ngModel)]="formState.shortDescription" name="shortDescription" rows="2"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
        </div>

        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Descripcion larga (Markdown)
          </label>
          <textarea [(ngModel)]="formState.longDescription" name="longDescription" rows="4"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
        </div>

        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Frase de marketing
          </label>
          <input [(ngModel)]="formState.marketingPhrase" name="marketingPhrase"
                 class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button type="button" (click)="openPreview()"
                class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg
                       hover:bg-blue-700 transition-colors cursor-pointer">
          👁️ Vista previa
        </button>
        <button type="submit"
                [disabled]="isSaving() || geminiBlockSave()"
                class="px-6 py-2 bg-amber-600 text-white font-medium rounded-lg
                       hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors cursor-pointer">
          @if (isSaving()) {
            Guardando...
          } @else if (geminiBlockSave()) {
            🚫 Edita campos para guardar
          } @else {
            {{ editingProduct() ? 'Actualizar' : 'Crear producto' }}
          }
        </button>

        @if (editingProduct()) {
          <button type="button" (click)="cancel.emit()"
                  class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900
                         dark:hover:text-white cursor-pointer">
            Cancelar
          </button>
        }

        @if (saveError()) {
          <span class="text-sm text-red-500 ml-2">{{ saveError() }}</span>
        }
        @if (saveSuccess()) {
          <span class="text-sm text-green-500 ml-2">✓ Guardado exitosamente</span>
        }
      </div>

    </form>

    <!-- Vista previa modal (solo presentacional, no escribe en Neon).
         Fuera del <form> para que ningún botón interno lo envíe. -->
    @if (showPreview() && previewProduct(); as preview) {
      <app-product-preview
        [product]="preview"
        [category]="previewCategory()"
        [geminiFields]="previewGeminiFields()"
        [saveLabel]="editingProduct() ? 'Actualizar' : 'Crear producto'"
        [saveDisabled]="isSaving() || geminiBlockSave()"
        [isSaving]="isSaving()"
        (close)="closePreview()"
        (save)="onSaveFromPreview()"
      />
    }
  `,
})
export class ProductFormComponent implements OnInit {
  private adminApi = inject(AdminApiService);
  private productService = inject(ProductService);

  readonly editingProduct = input<Product | null>(null);
  readonly saved = output<void>();
  readonly cancel = output<void>();

  protected categories = signal<Category[]>([]);
  protected suggestedNames = signal<string[]>([]);
  protected geminiBlockSave = signal(false);
  protected overrideOriginalPrice = signal(false);

  protected get calculatedOriginalPrice(): number {
    return Math.round(this.formState.currentPrice * 1.15);
  }
  protected readonly formatCurrency = formatCurrency;
  protected isSaving = signal(false);
  protected isGenerating = signal(false);
  protected isUploading = signal(false);
  protected isUploadingGallery = signal(false);
  protected saveError = signal('');
  protected geminiError = signal('');
  protected uploadError = signal('');
  protected saveSuccess = signal(false);

  // Vista previa + resaltado de completitud / Gemini
  protected showPreview = signal(false);
  protected previewProduct = signal<Product | null>(null);
  protected previewCategory = signal<Category | null>(null);
  protected previewGeminiFields = signal<string[]>([]);
  protected geminiFilledFields = signal<Set<string>>(new Set());
  protected dirtyGeminiFields = signal<Set<string>>(new Set());

  protected formState = {
    sku: '',
    categoryId: 1,
    name: '',
    image: '',
    imageList: [] as string[],
    originalPrice: 0,
    currentPrice: 0,
    shortDescription: '',
    longDescription: '',
    marketingPhrase: '',
    status: 'pendiente' as ProductStatus,
    taggedSection: null as 'destacados' | 'nuevos' | null,
    featuredImage: '',
    featureTag: '',
    resolvedId: null as number | null,  // id de Neon si el producto está migrado, si no id local
  };

  ngOnInit(): void {
    this.loadCategories();
    this.adminApi.refreshCacheIfNeeded();
  }

  private async loadCategories(): Promise<void> {
    try {
      const cats = await this.adminApi.getCategories();
      this.categories.set(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  ngOnChanges(): void {
    const prod = this.editingProduct();
    if (prod) {
      // 1. Mostrar el producto emitido por el dashboard al instante (correcto)
      this.applyProductToForm(prod);
      // 2. Buscar por SKU en la API (Neon-first) para refrescar si está migrado
      this.loadProductFromApiBySku(prod.sku);
    } else {
      this.resetForm();
    }
    this.saveError.set('');
    this.geminiError.set('');
    this.uploadError.set('');
    this.saveSuccess.set(false);
  }

  /**
   * Busca el producto por SKU (clave estable entre JSON y Neon).
   * Si existe en Neon, usa su id para guardar (el id local puede diferir del de Neon).
   */
  private async loadProductFromApiBySku(sku: string): Promise<void> {
    try {
      const latest = await this.adminApi.getProductBySku(sku);
      this.applyProductToForm(latest);
      this.formState.resolvedId = latest.id;
    } catch {
      // Fallback: usar id local
      const prod = this.editingProduct();
      this.formState.resolvedId = prod?.id ?? null;
    }
  }

  private applyProductToForm(prod: Product): void {
    // Si la imagen destacada guardada es la misma que la principal,
    // normalizar a '' para que el select muestre "Misma que la principal"
    const featuredImage =
      prod.featuredImage && prod.featuredImage === prod.image
        ? ''
        : (prod.featuredImage ?? '');

    this.formState = {
      sku: prod.sku,
      categoryId: prod.categoryId,
      name: prod.name ?? '',
      image: prod.image,
      imageList: prod.imageList ?? [],
      originalPrice: prod.originalPrice,
      currentPrice: prod.currentPrice,
      shortDescription: prod.shortDescription,
      longDescription: prod.longDescription,
      marketingPhrase: prod.marketingPhrase,
      status: prod.status,
      taggedSection: prod.taggedSection ?? null,
      featuredImage,
      featureTag: prod.featureTag ?? '',
      resolvedId: prod.id,
    };
  }

  async onSubmit(): Promise<void> {
    this.isSaving.set(true);
    this.saveError.set('');
    this.saveSuccess.set(false);

    try {
      const prod = this.editingProduct();
      const payload = {
        ...this.formState,
        name: this.formState.name || null,
        slug: generateSlug(this.formState.name || `producto-${Date.now()}`),
      };

      // Asegurar precio original calculado si no está en modo ajuste manual
      if (!this.overrideOriginalPrice()) {
        payload.originalPrice = this.calculatedOriginalPrice;
      }

      if (prod) {
        // Usar el id resuelto (Neon si el producto está migrado, si no local)
        const targetId = this.formState.resolvedId ?? prod.id;
        await this.adminApi.updateProduct(targetId, payload);
        this.productService.updateProduct(prod.id, payload);
      } else {
        const fullPayload = {
          ...payload,
          variantSelections: [],
          shippingComponents: [],
          tags: [],
          score: 0,
          ratings: 0,
        };
        const created = await this.adminApi.createProduct(fullPayload);
        this.productService.addProduct(fullPayload);
      }

      this.saveSuccess.set(true);
      setTimeout(() => {
        this.saved.emit();
        this.resetForm();
      }, 800);
    } catch (err) {
      this.saveError.set(`Error al guardar: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      this.isSaving.set(false);
    }
  }

  // ── Product highlighting ─────────────────────────────────────────────────

  protected get availableImages(): string[] {
    // Solo la galería (imageList): la imagen principal ya está cubierta
    // por la opción "Imagen #1 (principal)" (evita duplicarla).
    return this.formState.imageList.filter(Boolean);
  }

  /** Vista previa de la imagen destacada: la seleccionada, o la principal si es default */
  protected featuredImagePreview(): string {
    return this.formState.featuredImage || this.formState.image;
  }

  protected hasTag(): boolean {
    return this.formState.taggedSection !== null;
  }

  protected isTagged(section: 'destacados' | 'nuevos'): boolean {
    if (section === 'nuevos') {
      return this.formState.taggedSection === 'nuevos';
    }
    // 'destacados' o ambos
    return this.formState.taggedSection === 'destacados' || this.formState.taggedSection === 'nuevos';
  }

  protected toggleTag(section: 'destacados' | 'nuevos'): void {
    if (this.isTagged(section)) {
      // Quitar este tag
      if (section === 'nuevos') {
        this.formState.taggedSection = this.formState.taggedSection === 'nuevos' ? null : 'destacados';
      } else {
        this.formState.taggedSection = this.formState.taggedSection === 'destacados' ? null : 'nuevos';
      }
    } else {
      // Agregar este tag (manteniendo el otro si existe)
      const current = this.formState.taggedSection;
      if (!current) {
        this.formState.taggedSection = section;
      } else if (current !== section) {
        // Ya tiene un tag, agregar el otro significa 'nuevos' (el más específico)
        this.formState.taggedSection = 'nuevos';
      }
    }
  }

  // ── Price framing ────────────────────────────────────────────────────────

  onCurrentPriceChange(): void {
    if (!this.overrideOriginalPrice()) {
      this.formState.originalPrice = this.calculatedOriginalPrice;
    }
  }

  toggleOriginalPrice(): void {
    const newVal = !this.overrideOriginalPrice();
    this.overrideOriginalPrice.set(newVal);
    if (!newVal) {
      // Volver a auto: recalcular
      this.formState.originalPrice = this.calculatedOriginalPrice;
    }
  }

  // ── Form input (desbloquea guardado tras fallo de Gemini) ─────────────

  onFormInput(event?: Event): void {
    if (this.geminiBlockSave()) {
      this.geminiBlockSave.set(false);
    }
    // Marcar como "tocado por el admin" (pierde el resaltado azul de Gemini)
    const target = event?.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (target?.name) {
      this.markDirty(target.name);
    }
  }

  /** Un campo llenado por Gemini pierde su resaltado azul en cuanto el admin lo toca. */
  private markDirty(field: string): void {
    if (this.geminiFilledFields().has(field)) {
      this.dirtyGeminiFields.update(prev => new Set(prev).add(field));
    }
  }

  // ── Name selector ───────────────────────────────────────────────────────

  onNameSelected(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const fullName = select.value;
    if (fullName) {
      // El nombre ya viene con formato completo (categoría + maya + significado)
      this.formState.name = fullName;
      this.markDirty('name');
    }
  }

  // ── Main image (for Gemini) ──────────────────────────────────────────────

  async onMainFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isUploading.set(true);
    this.uploadError.set('');

    try {
      const result = await this.adminApi.uploadImage(file);
      this.formState.image = result.url;
      this.markDirty('image');
    } catch (err) {
      this.uploadError.set('Error al subir imagen');
      console.error('Upload failed:', err);
    } finally {
      this.isUploading.set(false);
    }
  }

  // ── Gallery images (imageList) ──────────────────────────────────────────

  async onGalleryFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isUploadingGallery.set(true);

    try {
      const result = await this.adminApi.uploadImage(file);
      this.formState.imageList = [...this.formState.imageList, result.url];
    } catch (err) {
      console.error('Gallery upload failed:', err);
    } finally {
      this.isUploadingGallery.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  removeGalleryImage(index: number): void {
    this.formState.imageList = this.formState.imageList.filter((_, i) => i !== index);
  }

  // ── Gemini ──────────────────────────────────────────────────────────────

  async generateWithGemini(): Promise<void> {
    if (!this.formState.image) return;

    this.isGenerating.set(true);
    this.geminiError.set('');
    this.suggestedNames.set([]);

    try {
      const category = this.categories().find(c => c.id === this.formState.categoryId);
      const categoryName = category?.name ?? this.getCategoryName(this.formState.categoryId);

      const result = await this.adminApi.generateContent(
        [this.formState.image],  // Solo la imagen principal va a Gemini
        categoryName,
        this.formState.categoryId  // ← Nuevo: pasar categoryId
      );

      this.suggestedNames.set(result.suggestedNames);
      // El nombre ya viene con formato completo (categoría + maya + significado)
      this.formState.name = result.suggestedNames[0];
      this.formState.shortDescription = result.shortDescription;
      this.formState.longDescription = result.longDescription;
      this.formState.marketingPhrase = result.marketingPhrase;

      // Si Gemini migró la imagen local a Vercel Blob, usar la URL de Blob
      const geminiFields = ['name', 'shortDescription', 'longDescription', 'marketingPhrase'];
      if (result.blobImageUrl) {
        this.formState.image = result.blobImageUrl;
        geminiFields.push('image');
      }

      // Registrar campos llenados por Gemini (resaltado azul hasta que el admin los toque)
      this.geminiFilledFields.update(prev => new Set([...prev, ...geminiFields]));
      this.dirtyGeminiFields.update(prev => {
        const next = new Set(prev);
        geminiFields.forEach(f => next.delete(f));
        return next;
      });
    } catch (err) {
      this.geminiError.set(err instanceof Error ? err.message : 'Error al generar contenido con IA');
      this.geminiBlockSave.set(true);
      console.error('Gemini generation failed:', err);
    } finally {
      this.isGenerating.set(false);
    }
  }

  private getCategoryName(categoryId: number): string {
    const found = this.categories().find(c => c.id === categoryId);
    return found?.name ?? 'General';
  }

  private resetForm(): void {
    this.formState = {
      sku: '',
      categoryId: 1,
      name: '',
      image: '',
      imageList: [],
      originalPrice: 0,
      currentPrice: 0,
      shortDescription: '',
      longDescription: '',
      marketingPhrase: '',
      status: 'pendiente',
      taggedSection: null,
      featuredImage: '',
      featureTag: '',
      resolvedId: null,
    };
    this.suggestedNames.set([]);
  }

  // ── Vista previa ──────────────────────────────────────────────────────────

  openPreview(): void {
    this.previewProduct.set(this.buildPreviewProduct());
    this.previewCategory.set(this.categories().find(c => c.id === this.formState.categoryId) ?? null);
    const gemini = [...this.geminiFilledFields()].filter(f => !this.dirtyGeminiFields().has(f));
    this.previewGeminiFields.set(gemini);
    this.showPreview.set(true);
  }

  closePreview(): void {
    this.showPreview.set(false);
  }

  onSaveFromPreview(): void {
    this.showPreview.set(false);
    void this.onSubmit();
  }

  /** Construye un Product sintético a partir del formState (no persistido). */
  private buildPreviewProduct(): Product {
    const now = new Date().toISOString();
    const existing = this.editingProduct();
    const originalPrice = this.overrideOriginalPrice()
      ? this.formState.originalPrice
      : this.calculatedOriginalPrice;

    return {
      id: existing?.id ?? 0,
      sku: this.formState.sku || 'SKU-PENDIENTE',
      categoryId: this.formState.categoryId,
      name: this.formState.name || '',
      slug: generateSlug(this.formState.name || `producto-${Date.now()}`),
      image: this.formState.image,
      imageList: this.formState.imageList,
      variantSelections: existing?.variantSelections ?? [],
      originalPrice,
      currentPrice: this.formState.currentPrice,
      shippingComponents: existing?.shippingComponents ?? [],
      taggedSection: this.formState.taggedSection,
      featuredImage: this.formState.featuredImage || this.formState.image,
      featureTag: this.formState.featureTag,
      tags: existing?.tags ?? [],
      score: existing?.score ?? 0,
      ratings: existing?.ratings ?? 0,
      shortDescription: this.formState.shortDescription,
      longDescription: this.formState.longDescription,
      marketingPhrase: this.formState.marketingPhrase,
      status: this.formState.status,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }
}
