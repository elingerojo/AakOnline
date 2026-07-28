import { Injectable } from '@angular/core';
import type { Product } from '@shared/models/product.model';
import type { Category } from '@shared/models/category.model';
import type { ShippingConfig } from '@shared/models/shipping-config.model';

export interface GeminiResult {
  suggestedName: string;
  shortDescription: string;
  longDescription: string;
  marketingPhrase: string;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private baseUrl = 'http://aakonline-production.up.railway.app/api';

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

  // ========== Gemini AI ==========

  async generateContent(images: string[], categoryName: string): Promise<GeminiResult> {
    const res = await fetch(`${this.baseUrl}/ai/generate-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, categoryName }),
    });
    if (!res.ok) throw new Error(`Failed to generate content: ${res.status}`);
    return res.json();
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
