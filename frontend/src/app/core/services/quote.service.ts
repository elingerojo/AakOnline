import { Injectable, signal, computed, effect } from '@angular/core';
import type { QuoteItem, QuoteSummary } from '@shared/models/quote.model';

const STORAGE_KEY = 'aak_quote_items';

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private itemsSignal = signal<QuoteItem[]>(this.loadFromStorage());

  /** Current quote items */
  readonly items = this.itemsSignal.asReadonly();

  /** Number of items in the quote */
  readonly itemCount = computed(() => this.items().length);

  /** Subtotal (sum of all item subtotals) */
  readonly subtotal = computed(() =>
    this.items().reduce((acc, item) => acc + item.subtotal, 0)
  );

  /** IVA (16% of subtotal) */
  readonly iva = computed(() => this.subtotal() * 0.16);

  /** Total shipping cost */
  readonly totalShipping = computed(() =>
    this.items().reduce((acc, item) => acc + item.shippingCost, 0)
  );

  /** Grand total (subtotal + iva + shipping) */
  readonly grandTotal = computed(() =>
    this.subtotal() + this.iva() + this.totalShipping()
  );

  constructor() {
    // Persist to localStorage whenever items change
    effect(() => {
      const current = this.itemsSignal();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    });
  }

  /** Check if a product is already in the quote */
  has(productId: number): boolean {
    return this.itemsSignal().some(i => i.productId === productId);
  }

  /**
   * Add or update an item in the quote.
   * If the product already exists, its qty and subtotal are updated (upsert).
   * If not, the new item is appended.
   */
  addItem(item: QuoteItem): void {
    this.itemsSignal.update(items => {
      const idx = items.findIndex(i => i.productId === item.productId);
      if (idx !== -1) {
        // Upsert: merge quantities
        const existing = items[idx];
        const merged = {
          ...existing,
          qty: existing.qty + item.qty,
          subtotal: existing.unitPrice * (existing.qty + item.qty),
        };
        return [...items.slice(0, idx), merged, ...items.slice(idx + 1)];
      }
      return [...items, item];
    });
  }

  /** Remove an item by product ID */
  removeItem(productId: number): void {
    this.itemsSignal.update(items => items.filter(i => i.productId !== productId));
  }

  /** Update the quantity of an item */
  updateQuantity(productId: number, qty: number): void {
    this.itemsSignal.update(items =>
      items.map(item =>
        item.productId === productId
          ? { ...item, qty, subtotal: item.unitPrice * qty }
          : item
      )
    );
  }

  /** Update shipping cost for an item */
  updateShippingCost(productId: number, shippingCost: number): void {
    this.itemsSignal.update(items =>
      items.map(item =>
        item.productId === productId ? { ...item, shippingCost } : item
      )
    );
  }

  /** Clear all items */
  clear(): void {
    this.itemsSignal.set([]);
  }

  /** Get a full summary of the current quote */
  getSummary(distanceKm: number = 0): QuoteSummary {
    return {
      items: this.itemsSignal(),
      subtotal: this.subtotal(),
      iva: this.iva(),
      totalShipping: this.totalShipping(),
      grandTotal: this.grandTotal(),
      distanceKm,
    };
  }

  private loadFromStorage(): QuoteItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed: QuoteItem[] = JSON.parse(data);
      // Deduplicate by productId (keep last occurrence) to guard against stale duplicates
      const seen = new Map<number, QuoteItem>();
      for (const item of parsed) {
        seen.set(item.productId, item);
      }
      return Array.from(seen.values());
    } catch {
      return [];
    }
  }
}
