import { Injectable, signal, computed } from '@angular/core';
import type { Category } from '@shared/models/category.model';
import initialCategories from '../data/categories.json';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private categoriesState = signal<Category[]>(initialCategories as Category[]);

  /** All categories */
  readonly categories = this.categoriesState.asReadonly();

  /** Total number of categories */
  readonly count = computed(() => this.categories().length);

  /** Get a category by its slug */
  getBySlug(slug: string): Category | undefined {
    return this.categories().find(c => c.slug === slug);
  }

  /** Get a category by its ID */
  getById(id: number): Category | undefined {
    return this.categories().find(c => c.id === id);
  }

  /** Get categories that have at least one variant defined */
  readonly categoriesWithVariants = computed(() =>
    this.categories().filter(c => c.variants.length > 0)
  );
}
