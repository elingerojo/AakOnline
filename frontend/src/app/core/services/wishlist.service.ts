import { Injectable, signal, computed, effect } from '@angular/core';

const STORAGE_KEY = 'aak_wishlist';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private itemsSignal = signal<number[]>(this.loadFromStorage());

  /** Array of product IDs in the wishlist */
  readonly items = this.itemsSignal.asReadonly();

  /** Number of items in the wishlist */
  readonly count = computed(() => this.items().length);

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.itemsSignal()));
    });
  }

  /** Toggle a product in the wishlist (add if not present, remove if present) */
  toggle(productId: number): void {
    this.itemsSignal.update(items =>
      items.includes(productId)
        ? items.filter(id => id !== productId)
        : [...items, productId]
    );
  }

  /** Check if a product is in the wishlist */
  has(productId: number): boolean {
    return this.itemsSignal().includes(productId);
  }

  /** Add a product to the wishlist */
  add(productId: number): void {
    if (!this.has(productId)) {
      this.itemsSignal.update(items => [...items, productId]);
    }
  }

  /** Remove a product from the wishlist */
  remove(productId: number): void {
    this.itemsSignal.update(items => items.filter(id => id !== productId));
  }

  /** Clear the entire wishlist */
  clear(): void {
    this.itemsSignal.set([]);
  }

  private loadFromStorage(): number[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
}
