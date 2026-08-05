import { Injectable, signal, computed } from '@angular/core';
import type { Product, ProductStatus } from '@shared/models/product.model';
import initialProducts from '../data/products.json';

export type ProductFilter = 'all' | ProductStatus;

@Injectable({ providedIn: 'root' })
export class ProductService {
  private productsState = signal<Product[]>(initialProducts as Product[]);

  /** Current filter selection */
  readonly filter = signal<ProductFilter>('all');

  /** Filtered products based on current filter */
  readonly filteredProducts = computed(() => {
    const products = this.productsState();
    const activeFilter = this.filter();
    if (activeFilter === 'all') return products;
    return products.filter(p => p.status === activeFilter);
  });

  /** All products (unfiltered) */
  readonly products = this.productsState.asReadonly();

  /** Count of products per status */
  readonly statusCounts = computed(() => {
    const list = this.productsState();
    return {
      all: list.length,
      pendiente: list.filter(p => p.status === 'pendiente').length,
      activo: list.filter(p => p.status === 'activo').length,
      suspendido: list.filter(p => p.status === 'suspendido').length,
      almacenado: list.filter(p => p.status === 'almacenado').length,
    };
  });

  /**
   * Productos visibles públicamente — única fuente de verdad para la regla de
   * visibilidad: solo status === 'activo'. Toda ruta pública (shop, categoría,
   * detalle, home) debe derivar de este computed, nunca de productsState.
   * El admin NO usa este acceso; sigue operando sobre la lista completa.
   */
  readonly publicProducts = computed(() =>
    this.productsState().filter(p => p.status === 'activo')
  );

  /** Productos de la sección "Destacados" del Home (solo activos, vía publicProducts). */
  readonly featuredProducts = computed(() =>
    this.publicProducts()
      .filter(p => p.featuredImage?.trim() && p.featuredSection === 'destacados')
      .slice(0, 8) // max 8 products
  );

  /** Productos de la sección "Nuevos" del Home (solo activos, vía publicProducts). */
  readonly newProducts = computed(() =>
    this.publicProducts().filter(
      p => p.featuredImage?.trim() && p.featuredSection === 'nuevos'
    )
  );

  // ---- Mutations (for admin use) ----

  /** Reemplaza todo el catálogo (ej: precarga Neon-first desde la API del admin) */
  setProducts(products: Product[]): void {
    this.productsState.set(products);
  }

  /** Add a new product */
  addProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): void {
    const now = new Date().toISOString();
    const maxId = this.productsState().reduce((max, p) => Math.max(max, p.id), 0);
    const newProduct: Product = {
      ...product,
      id: maxId + 1,
      createdAt: now,
      updatedAt: now,
    };
    this.productsState.update(items => [...items, newProduct]);
  }

  /** Update an existing product */
  updateProduct(id: number, changes: Partial<Product>): void {
    this.productsState.update(items =>
      items.map(item =>
        item.id === id
          ? { ...item, ...changes, updatedAt: new Date().toISOString() }
          : item
      )
    );
  }

  /** Delete a product by ID */
  deleteProduct(id: number): void {
    this.productsState.update(items => items.filter(item => item.id !== id));
  }

  /** Check if a SKU already exists (for validation) */
  skuExists(sku: string, excludeProductId?: number): boolean {
    const normalized = sku.trim().toUpperCase();
    return this.productsState().some(
      p => p.sku.trim().toUpperCase() === normalized && p.id !== excludeProductId
    );
  }
}
