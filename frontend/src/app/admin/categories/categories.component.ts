import { Component, inject, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminNavComponent } from '../admin-nav/admin-nav.component';
import type { Category, CategoryVariant } from '@shared/models/category.model';
import { generateSlug } from '../../core/utils/text-utils';

interface CategoryFormState {
  id: number | null;
  name: string;
  slug: string;
  productImage: string;
  bgImage: string;
  models: number;
  variants: CategoryVariant[];
}

const emptyVariant = (): CategoryVariant => ({ id: '', label: '', options: [{ name: '', price: 0 }] });

const emptyForm = (): CategoryFormState => ({
  id: null,
  name: '',
  slug: '',
  productImage: '',
  bgImage: '',
  models: 0,
  variants: [],
});

/**
 * Editor de categorías y sus variantes (Phase 1).
 * Lista las categorías (Neon-first vía AdminApiService), permite crear/editar
 * cada categoría y editar su lista de variantes:
 *   variante = { id, label, options: [{ name, price }] }
 * Las variantes se guardan como jsonb en la tabla `categories` (mismo API ya existente).
 */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [FormsModule, AdminNavComponent],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <!-- Header -->
      <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">Admin - Categorías</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">Categorías y sus variantes</p>
          </div>
          <app-admin-nav />
        </div>
      </header>

      <div class="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Lista de categorías -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 h-fit">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Categorías</h2>
            <button (click)="newCategory()"
                    class="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 cursor-pointer">
              + Nueva
            </button>
          </div>

          <div class="space-y-2">
            @for (cat of categories(); track cat.id) {
              <div class="flex items-center justify-between gap-2 rounded-lg border px-3 py-2
                          {{ selectedId() === cat.id ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-gray-700' }}">
                <button (click)="editCategory(cat)"
                        class="text-sm text-left text-gray-800 dark:text-gray-200 hover:text-amber-600 cursor-pointer flex-1">
                  {{ cat.name }}
                  @if ((cat.variants?.length ?? 0) > 0) {
                    <span class="text-xs text-gray-400 ml-1">({{ cat.variants!.length }} var.)</span>
                  }
                </button>
                <button (click)="remove(cat)"
                        class="text-xs text-red-500 hover:text-red-700 cursor-pointer" title="Eliminar">🗑</button>
              </div>
            } @empty {
              <p class="text-sm text-gray-400">Sin categorías.</p>
            }
          </div>
        </div>

        <!-- Formulario de categoría + variantes -->
        <div class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {{ formState.id != null ? 'Editar categoría' : 'Nueva categoría' }}
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
              <input [(ngModel)]="formState.name" name="cname"
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
              <input [(ngModel)]="formState.slug" name="cslug" placeholder="(auto)"
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Imagen de producto (URL)</label>
              <input [(ngModel)]="formState.productImage" name="cimage"
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Imagen de fondo (URL)</label>
              <input [(ngModel)]="formState.bgImage" name="cbg"
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nº de modelos</label>
              <input type="number" [(ngModel)]="formState.models" name="cmodels"
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>

          <!-- Editor de variantes -->
          <div class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Variantes de la categoría</h3>
              <button (click)="addVariant()"
                      class="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 cursor-pointer">
                + Agregar variante
              </button>
            </div>

            @for (variant of formState.variants; track variant; let vi = $index) {
              <div class="mb-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <div class="flex items-center gap-2 mb-3">
                  <label class="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Etiqueta</label>
                  <input [(ngModel)]="variant.label" [name]="'vlabel-' + vi" placeholder="Ej: Tejido"
                         class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  <button (click)="removeVariant(vi)"
                          class="text-xs text-red-500 hover:text-red-700 cursor-pointer whitespace-nowrap">🗑 Variante</button>
                </div>

                <div class="space-y-2">
                  @for (opt of variant.options; track opt; let oi = $index) {
                    <div class="flex items-center gap-2">
                      <input [(ngModel)]="opt.name" [name]="'optname-' + vi + '-' + oi" placeholder="Ej: Claro"
                             class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      <span class="text-xs text-gray-400">$</span>
                      <input type="number" [(ngModel)]="opt.price" [name]="'optprice-' + vi + '-' + oi" placeholder="0" min="0"
                             class="w-24 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                      <button (click)="removeOption(vi, oi)"
                              class="text-xs text-red-500 hover:text-red-700 cursor-pointer">✕</button>
                    </div>
                  }
                </div>

                <button (click)="addOption(vi)"
                        class="mt-2 text-xs text-blue-600 hover:text-blue-700 cursor-pointer">+ Agregar opción</button>
              </div>
            } @empty {
              <p class="text-sm text-gray-400 mb-3">Sin variantes. Agrega una para definir tejidos, tamaños, colores, etc.</p>
            }
          </div>

          <!-- Acciones -->
          <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <button (click)="save()" [disabled]="isLoading()"
                    class="px-6 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {{ isLoading() ? 'Guardando...' : (formState.id != null ? 'Actualizar' : 'Crear categoría') }}
            </button>
            @if (saveError()) {
              <span class="text-sm text-red-500">{{ saveError() }}</span>
            }
            @if (saveSuccess()) {
              <span class="text-sm text-green-500">✓ Guardado exitosamente</span>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CategoriesComponent implements OnInit {
  private adminApi = inject(AdminApiService);

  protected categories = signal<Category[]>([]);
  protected selectedId = signal<number | null>(null);
  protected formState = emptyForm();
  protected isLoading = signal(false);
  protected saveError = signal('');
  protected saveSuccess = signal(false);

  ngOnInit(): void {
    this.loadCategories();
  }

  private async loadCategories(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.categories.set(await this.adminApi.getCategories());
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  newCategory(): void {
    this.selectedId.set(null);
    this.formState = emptyForm();
    this.saveError.set('');
    this.saveSuccess.set(false);
  }

  editCategory(cat: Category): void {
    this.selectedId.set(cat.id);
    this.formState = {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      productImage: cat.productImage,
      bgImage: cat.bgImage,
      models: cat.models ?? 0,
      variants: (cat.variants ?? []).map(v => ({
        id: v.id,
        label: v.label,
        options: (v.options ?? []).map(o => ({ name: o.name, price: o.price ?? 0 })),
      })),
    };
    this.saveError.set('');
    this.saveSuccess.set(false);
  }

  async save(): Promise<void> {
    const name = this.formState.name.trim();
    if (!name) {
      this.saveError.set('El nombre de la categoría es obligatorio.');
      return;
    }

    this.isLoading.set(true);
    this.saveError.set('');
    this.saveSuccess.set(false);

    const variants: CategoryVariant[] = this.formState.variants
      .filter(v => v.label.trim() !== '')
      .map(v => ({
        id: v.id?.trim() || generateSlug(v.label.trim() || `variante-${Date.now()}`),
        label: v.label.trim(),
        options: v.options
          .filter(o => o.name.trim() !== '')
          .map(o => ({ name: o.name.trim(), price: Number(o.price) || 0 })),
      }));

    const payload = {
      name,
      slug: this.formState.slug?.trim() || generateSlug(name),
      productImage: this.formState.productImage?.trim() || '',
      bgImage: this.formState.bgImage?.trim() || '',
      models: Number(this.formState.models) || 0,
      variants,
    };

    try {
      if (this.formState.id != null) {
        await this.adminApi.updateCategory(this.formState.id, payload);
      } else {
        const created = await this.adminApi.createCategory(payload);
        this.selectedId.set(created.id);
        this.formState.id = created.id;
      }
      this.saveSuccess.set(true);
      await this.loadCategories();
    } catch (err) {
      this.saveError.set(err instanceof Error ? err.message : 'Error al guardar la categoría');
    } finally {
      this.isLoading.set(false);
    }
  }

  async remove(cat: Category): Promise<void> {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
    try {
      await this.adminApi.deleteCategory(cat.id);
      if (this.selectedId() === cat.id) this.newCategory();
      await this.loadCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  }

  // ── Editor de variantes ────────────────────────────────────────────────────

  addVariant(): void {
    this.formState.variants = [...this.formState.variants, emptyVariant()];
  }

  removeVariant(index: number): void {
    this.formState.variants = this.formState.variants.filter((_, i) => i !== index);
  }

  addOption(vIndex: number): void {
    const variants = [...this.formState.variants];
    variants[vIndex] = { ...variants[vIndex], options: [...variants[vIndex].options, { name: '', price: 0 }] };
    this.formState.variants = variants;
  }

  removeOption(vIndex: number, oIndex: number): void {
    const variants = [...this.formState.variants];
    variants[vIndex] = {
      ...variants[vIndex],
      options: variants[vIndex].options.filter((_, i) => i !== oIndex),
    };
    this.formState.variants = variants;
  }
}
