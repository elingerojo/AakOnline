import { db } from '../db/index.js';
import { products } from '../schema/index.js';
import { eq, desc, sql } from 'drizzle-orm';

interface CachedProduct {
  name: string | null;
  shortDescription: string;
  longDescription: string;
  marketingPhrase: string;
}

/**
 * Caché en memoria de los últimos 3 productos guardados por categoría.
 * Se usa para generar el texto de exclusión en el prompt de Gemini.
 */
class PromptCache {
  private cache: Map<number, CachedProduct[]> = new Map();
  private lastRefreshDate: string | null = null;

  /**
   * Inicializa el caché desde Neon al arrancar el servidor.
   */
  async initialize(): Promise<void> {
    try {
      const allCategories = await db
        .select({ categoryId: products.categoryId })
        .from(products)
        .groupBy(products.categoryId);

      for (const { categoryId } of allCategories) {
        await this.loadCategory(categoryId);
      }

      this.lastRefreshDate = new Date().toISOString().split('T')[0];
      console.log(`[PromptCache] Initialized with ${allCategories.length} categories`);
    } catch (error) {
      console.warn('[PromptCache] Neon not available at init, cache will be empty:', (error as Error).message);
    }
  }

  /**
   * Recarga todos los productos del caché desde Neon.
   */
  async refresh(): Promise<void> {
    this.cache.clear();
    await this.initialize();
  }

  /**
   * Recarga solo si es un día diferente al último refresh.
   */
  async refreshIfNeeded(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    if (this.lastRefreshDate !== today) {
      console.log('[PromptCache] New day detected, refreshing cache...');
      await this.refresh();
    }
  }

  /**
   * Actualiza el caché cuando un producto es guardado exitosamente.
   */
  onProductSaved(product: { categoryId: number; name: string | null; shortDescription?: string; longDescription?: string; marketingPhrase?: string }): void {
    const entry: CachedProduct = {
      name: product.name,
      shortDescription: product.shortDescription ?? '',
      longDescription: product.longDescription ?? '',
      marketingPhrase: product.marketingPhrase ?? '',
    };

    const categoryProducts = this.cache.get(product.categoryId) ?? [];
    categoryProducts.unshift(entry);
    this.cache.set(product.categoryId, categoryProducts.slice(0, 3));
  }

  /**
   * Genera el texto de exclusión para el prompt de Gemini.
   * Si no hay productos en caché para la categoría, retorna string vacío.
   */
  getExclusionText(categoryId: number, categoryName: string): string {
    const products = this.cache.get(categoryId) ?? [];
    if (products.length === 0) return '';

    const lines = products.map((p, i) =>
      `${i + 1}. "${p.name ?? 'Sin nombre'}" — "${p.shortDescription}"`
    );

    return [
      '',
      '[PRODUCTOS RECIENTES EXCLUIDOS]',
      `Los siguientes productos ya existen en la categoria "${categoryName}".`,
      'NO uses estos nombres, descripciones ni frases de marketing.',
      'Genera contenido completamente original y diferente.',
      '',
      ...lines,
      '',
    ].join('\n');
  }

  private async loadCategory(categoryId: number): Promise<void> {
    const recent = await db
      .select({
        name: products.name,
        shortDescription: products.shortDescription,
        longDescription: products.longDescription,
        marketingPhrase: products.marketingPhrase,
      })
      .from(products)
      .where(eq(products.categoryId, categoryId))
      .orderBy(desc(products.updatedAt))
      .limit(3);

    if (recent.length > 0) {
      this.cache.set(categoryId, recent as CachedProduct[]);
    }
  }
}

export const promptCache = new PromptCache();
