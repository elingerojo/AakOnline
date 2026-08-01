import { Injectable } from '@angular/core';
import type { Product } from '@shared/models/product.model';
import type { Category } from '@shared/models/category.model';
import type { ShippingConfig } from '@shared/models/shipping-config.model';

export interface GeminiResult {
  suggestedNames: string[];
  shortDescription: string;
  longDescription: string;
  marketingPhrase: string;
  blobImageUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private baseUrl = 'https://aakonline-production.up.railway.app/api';
  private readonly CACHE_KEY = 'aak-cache-refresh-date';

  // ========== Products ==========

  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${this.baseUrl}/products`);
    if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
    return res.json();
  }

  async getProduct(id: number): Promise<Product> {
    const res = await fetch(`${this.baseUrl}/products/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch product ${id}: ${res.status}`);
    return res.json();
  }

  /**
   * Busca un producto por SKU (Neon-first, JSON-fallback).
   * El SKU es la clave estable entre el JSON local y Neon (los ids pueden diferir).
   */
  async getProductBySku(sku: string): Promise<Product> {
    const res = await fetch(`${this.baseUrl}/products/sku/${encodeURIComponent(sku)}`);
    if (!res.ok) throw new Error(`Failed to fetch product by SKU ${sku}: ${res.status}`);
    return res.json();
  }

  async createProduct(data: Partial<Product>): Promise<Product> {
    const res = await fetch(`${this.baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create product: ${res.status}`);
    return res.json();
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    const res = await fetch(`${this.baseUrl}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update product ${id}: ${res.status}`);
    return res.json();
  }

  async deleteProduct(id: number): Promise<void> {
    const res = await fetch(`${this.baseUrl}/products/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete product ${id}: ${res.status}`);
  }

  // ========== Categories ==========

  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${this.baseUrl}/categories`);
    if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
    return res.json();
  }

  async updateCategory(id: number, data: Partial<Category>): Promise<Category> {
    const res = await fetch(`${this.baseUrl}/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update category ${id}: ${res.status}`);
    return res.json();
  }

  async createCategory(data: Partial<Category>): Promise<Category> {
    const res = await fetch(`${this.baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create category: ${res.status}`);
    return res.json();
  }

  async deleteCategory(id: number): Promise<void> {
    const res = await fetch(`${this.baseUrl}/categories/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete category ${id}: ${res.status}`);
  }

  // ========== Gemini AI ==========

  async generateContent(images: string[], categoryName: string, categoryId: number): Promise<GeminiResult> {
    const res = await fetch(`${this.baseUrl}/ai/generate-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, categoryName, categoryId }),
    });

    if (!res.ok) {
      // Intentar parsear el cuerpo del error (GeminiError del backend)
      try {
        const errBody = await res.json();
        throw new Error(errBody.error ?? `Error del servidor: ${res.status}`);
      } catch {
        throw new Error(`Error al generar contenido: ${res.status}`);
      }
    }

    return res.json();
  }

  // ========== Cache Refresh ==========

  /**
   * Refresca el caché de exclusión de Gemini (solo si es un día nuevo).
   * Se llama al cargar el dashboard de admin (1ra vez del día).
   */
  async refreshCacheIfNeeded(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const lastRefresh = localStorage.getItem(this.CACHE_KEY);

    if (lastRefresh === today) return; // Ya se refrescó hoy

    try {
      await fetch(`${this.baseUrl}/cache/refresh`, { method: 'POST' });
      localStorage.setItem(this.CACHE_KEY, today);
    } catch (err) {
      console.warn('[Cache] Refresh failed (non-critical):', err);
    }
  }

  // ========== Shipping Config ==========

  async getShippingConfig(): Promise<{ categories: ShippingConfig[]; defaultExtraUnitFactor: number }> {
    const res = await fetch(`${this.baseUrl}/shipping-config`);
    if (!res.ok) throw new Error(`Failed to fetch shipping config: ${res.status}`);
    return res.json();
  }

  async updateShippingConfig(data: {
    categories?: ShippingConfig[];
    defaultExtraUnitFactor?: number;
  }): Promise<{ categories: ShippingConfig[]; defaultExtraUnitFactor: number }> {
    const res = await fetch(`${this.baseUrl}/shipping-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update shipping config: ${res.status}`);
    return res.json();
  }

  // ========== Image Upload ==========

  async uploadImage(file: File): Promise<{ url: string; filename: string; size: number }> {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${this.baseUrl}/images/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`Failed to upload image: ${res.status}`);
    return res.json();
  }
}
