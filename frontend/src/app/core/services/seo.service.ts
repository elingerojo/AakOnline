import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoConfig {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
}

const DEFAULT_CONFIG: SeoConfig = {
  title: 'Aak Artesanías — Muebles Artesanales Mexicanos',
  description:
    'Descubra muebles artesanales mexicanos hechos a mano. Calidad, diseño e innovación en piezas únicas para el hogar.',
  image: 'assets/img/Logo_Aak_para-App-01.png',
  url: 'https://aak-artesanias.vercel.app',
  type: 'website',
};

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly titleService = inject(Title);

  /** Set all SEO meta tags for a given page configuration */
  setPageSeo(config: Partial<SeoConfig>): void {
    const merged: SeoConfig = { ...DEFAULT_CONFIG, ...config };

    // Document title
    this.titleService.setTitle(merged.title);

    // Standard meta
    this.meta.updateTag({ name: 'description', content: merged.description });

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: merged.title });
    this.meta.updateTag({ property: 'og:description', content: merged.description });
    this.meta.updateTag({ property: 'og:type', content: merged.type ?? 'website' });
    this.meta.updateTag({ property: 'og:url', content: merged.url ?? DEFAULT_CONFIG.url! });
    if (merged.image) {
      this.meta.updateTag({
        property: 'og:image',
        content: merged.image.startsWith('http') ? merged.image : `${DEFAULT_CONFIG.url}/${merged.image}`,
      });
    }

    // Twitter Card
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: merged.title });
    this.meta.updateTag({ name: 'twitter:description', content: merged.description });
    if (merged.image) {
      this.meta.updateTag({
        name: 'twitter:image',
        content: merged.image.startsWith('http') ? merged.image : `${DEFAULT_CONFIG.url}/${merged.image}`,
      });
    }
  }
}
