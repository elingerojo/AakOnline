import { Component, inject, input, output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ProductService } from '../../core/services/product.service';
import type { Product, ProductStatus } from '@shared/models/product.model';
import type { Category } from '@shared/models/category.model';
import { generateSlug, formatCurrency } from '../../core/utils/text-utils';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="onSubmit()" (input)="onFormInput()" class="space-y-6">
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
                  <option [value]="name" [selected]="formState.name === name.split(' (')[0]">
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
          <input type="number" [(ngModel)]="formState.currentPrice" name="currentPrice" required
                 (input)="onCurrentPriceChange()"
                 class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Precio original
            <span class="text-xs text-gray-400 ml-1">(+15% framing)</span>
          </label>
          @if (overrideOriginalPrice()) {
            <div class="flex gap-2 items-center">
              <input type="number" [(ngModel)]="formState.originalPrice" name="originalPrice"
                     class="flex-1 px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg
                            bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white" />
              <button type="button" (click)="overrideOriginalPrice.set(false)"
                      class="text-xs text-gray-500 hover:text-gray-700 cursor-pointer whitespace-nowrap">
                Auto
              </button>
            </div>
          } @else {
            <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg
                        border border-gray-200 dark:border-gray-700">
              <span class="text-gray-900 dark:text-white font-medium">
                {{ formatCurrency(calculatedOriginalPrice) }}
              </span>
              <span class="text-xs text-gray-400">(+15%)</span>
              <button type="button" (click)="overrideOriginalPrice.set(true)"
                      class="text-xs text-amber-600 hover:text-amber-700 ml-auto cursor-pointer">
                Ajustar
              </button>
            </div>
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
      // Neon-first: intentar obtener datos más recientes de la API
      this.loadProductFromApi(prod.id);
    } else {
      this.resetForm();
    }
    this.saveError.set('');
    this.geminiError.set('');
    this.uploadError.set('');
    this.saveSuccess.set(false);
  }

  private async loadProductFromApi(id: number): Promise<void> {
    try {
      const latest = await this.adminApi.getProduct(id);
      this.applyProductToForm(latest);
    } catch {
      // Fallback: usar datos locales
      const prod = this.editingProduct();
      if (prod) this.applyProductToForm(prod);
    }
  }

  private applyProductToForm(prod: Product): void {
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

      if (prod) {
        await this.adminApi.updateProduct(prod.id, payload);
        this.productService.updateProduct(prod.id, payload);
      } else {
        const fullPayload = {
          ...payload,
          variantSelections: [],
          shippingComponents: [],
          taggedSection: null,
          featuredImage: '',
          featureTag: '',
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

  // ── Price framing ────────────────────────────────────────────────────────

  onCurrentPriceChange(): void {
    if (!this.overrideOriginalPrice()) {
      this.formState.originalPrice = this.calculatedOriginalPrice;
    }
  }

  // ── Form input (desbloquea guardado tras fallo de Gemini) ─────────────

  onFormInput(): void {
    if (this.geminiBlockSave()) {
      this.geminiBlockSave.set(false);
    }
  }

  // ── Name selector ───────────────────────────────────────────────────────

  onNameSelected(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const fullName = select.value;
    if (fullName) {
      // Extraer solo el nombre maya (antes del paréntesis)
      this.formState.name = fullName.split(' (')[0];
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
      this.formState.name = result.suggestedNames[0].split(' (')[0];
      this.formState.shortDescription = result.shortDescription;
      this.formState.longDescription = result.longDescription;
      this.formState.marketingPhrase = result.marketingPhrase;
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
    };
    this.suggestedNames.set([]);
  }
}
