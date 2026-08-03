import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface HeroSlide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  badge?: string;
  price?: string;
  ctaLink: string;
  ctaText: string;
  year?: string;
  seasonImage?: string;
}

@Component({
  selector: 'app-hero-slider',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="hero-slider-wrapper"
         (mouseenter)="onMouseEnter()"
         (mouseleave)="onMouseLeave()">

      <!-- Slides track -->
      <div class="hero-slides-track"
           [style.transform]="'translateX(-' + currentSlide() * 100 + '%)'">

        @for (slide of slides; track slide.id; let i = $index) {
          <div class="hero-slide"
               [class.active]="i === currentSlide()">
            <div class="relative pt-8 sm:pt-12 xl:pt-16 pb-12 sm:pb-24 px-[15px] sm:px-12 bg-neutral-100 dark:bg-dark-secondary">
              <div class="container">
                <div class="max-w-[1720px] mx-auto">
                  <div class="flex items-center justify-between gap-8 flex-col sm:flex-row">

                    <!-- Text content -->
                    <div class="relative z-10 sm:max-w-[632px] w-full slider-content">
                      <div class="flex items-end content-top">
                        <span class="font-bold text-5xl sm:text-7xl xl:text-9xl text-title leading-none dark:text-white">
                          {{ slide.year || '2026' }}
                        </span>
                        @if (slide.seasonImage) {
                          <img class="-ml-22 -mt-10 z-[-1] sm:-ml-10 sm:mb-5 w-[150px] sm:w-[200px] lg:w-[250px] xl:w-full"
                               [src]="slide.seasonImage"
                               alt="temporada">
                        }
                      </div>
                      <h2 class="mt-[10px] font-normal text-3xl sm:text-4xl xl:text-5xl !leading-[1.3] dark:text-white">
                        {{ slide.title }}
                      </h2>
                      <p class="dark:text-white-light mt-3 md:mt-4 sm:max-w-[450px] xl:max-w-full">
                        {{ slide.description }}
                      </p>
                      <div class="button mt-4 md:mt-6">
                        <a class="btn btn-outline"
                           [routerLink]="slide.ctaLink"
                           [attr.data-text]="slide.ctaText">
                          <span>{{ slide.ctaText }}</span>
                        </a>
                      </div>
                    </div>

                    <!-- Image -->
                    <div class="relative sm:max-w-[750px] w-full">
                      <img style="position:inherit;"
                           class="ml-2 sm:mt-30 sm:ml-6 lg:mt-0 lg:ml-6 slider-img"
                           [src]="slide.image"
                           [alt]="slide.title">

                      @if (slide.badge) {
                        <div class="absolute z-10 right-2 bottom-0 shape-02">
                          <svg width="101" height="83" viewBox="0 0 101 83" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M29.1775 77.3654C11.2192 68.7991 -2.66244 48.3121 0.433831 32.2115C3.4785 16.0593 23.6043 4.29344 44.8653 0.990749C66.0748 -2.36354 88.626 2.74531 96.6247 17.143C104.572 31.5922 98.0696 55.3303 83.6719 68.9023C69.3259 82.5259 47.1875 85.8802 29.1775 77.3654Z" fill="#BB976D"/>
                          </svg>
                          <div class="text-center absolute top-[20%] left-[25%] z-30">
                            <h3 class="font-semibold leading-none text-white">{{ slide.badge }}</h3>
                            <p class="leading-none text-white mt-1">MENOS</p>
                          </div>
                        </div>
                      }

                      @if (slide.price) {
                        <div class="absolute -top-4 -left-3 z-10 sm:top-1 sm:left-4 md:top-10 lg:top-16 lg:left-1 shape-01">
                          <svg class="w-[180px] h-[150px] sm:w-[300px] sm:h-[250px]" viewBox="0 0 501 410" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M93.5685 350.941C17.9186 286.326 -22.6142 169.412 13.177 95.6561C48.7857 21.5837 161.217 -9.19765 268.179 2.36595C374.958 13.6135 477.265 67.4732 497.265 147.363C516.948 227.436 454.823 333.672 367.72 380.59C280.8 427.824 169.535 415.374 93.5685 350.941Z" fill="#BB976D" opacity="0.1"/>
                          </svg>
                          <div class="absolute top-1/4 left-[10%] xl:left-[20%] z-30">
                            <h4 class="leading-none text-primary dark:text-primary font-semibold">{{ slide.price }}</h4>
                            <h3 class="leading-none mt-4">{{ slide.subtitle }}</h3>
                            <div class="group mt-[10px]">
                              <a [routerLink]="slide.ctaLink"
                                 class="text-lg leading-none text-title font-medium text-underline dark:text-white">
                                Ver m&aacute;s
                              </a>
                            </div>
                          </div>
                        </div>
                      }
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Navigation arrows -->
      @if (slides.length > 1) {
        <button class="hero-slider-arrow hero-slider-arrow--prev"
                aria-label="Anterior"
                (click)="prev()">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <button class="hero-slider-arrow hero-slider-arrow--next"
                aria-label="Siguiente"
                (click)="next()">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      }

      <!-- Dots navigation -->
      @if (slides.length > 1) {
        <div class="hero-slider-dots">
          @for (slide of slides; track slide.id; let i = $index) {
            <button class="hero-slider-dot"
                    [class.active]="i === currentSlide()"
                    (click)="goToSlide(i)"
                    [attr.aria-label]="'Ir al slide ' + (i + 1)">
            </button>
          }
        </div>
      }
    </div>
  `,
  styleUrls: ['./hero-slider.component.css'],
})
export class HeroSliderComponent implements OnInit, OnDestroy {
  /** Slides data - can be overridden via input later */
  slides: HeroSlide[] = [
    {
      id: 1,
      title: 'Los Nuevos Dise\u00f1os que No Te Puedes Perder han llegado.',
      subtitle: 'Sill\u00f3n Rey Maya',
      description: 'Descubre el nuevo estilo y calidad de muebles 100% artesanales mexicanos con mezclas entre retro y cl\u00e1sico. Dise\u00f1os que transformar\u00e1n tu hogar y lucir\u00e1n tu gusto por lo aut\u00e9ntico y original.',
      image: 'assets/img/home-v1/063-no-bg-01_banner-02.png',
      badge: '-15%',
      price: '$ 8,199 pesos',
      ctaLink: '/shop',
      ctaText: 'Explora Ahora',
      year: '2026',
      seasonImage: 'assets/img/shortcode/carousel/Verano.png',
    },
    {
      id: 2,
      title: 'Nuevo Inventario de los modelos Cl\u00e1sicos favoritos!',
      subtitle: 'Sill\u00f3n Retro Maya',
      description: 'Descubre la dedicaci\u00f3n a la calidad en este nuevo inventario de modelos cl\u00e1sicos hechos por artesanos mexicanos. Eleva tu estilo de vivir con muebles aut\u00e9nticos artesanales.',
      image: 'assets/img/home-v1/089-hero-banner-01.png',
      badge: '-10%',
      price: '$ 8,199 pesos',
      ctaLink: '/shop',
      ctaText: 'Explora Ahora',
      year: '2026',
      seasonImage: 'assets/img/shortcode/carousel/Summer.png',
    },
  ];

  // --- Slider state ---
  currentSlide = signal<number>(0);
  isPaused = signal<boolean>(false);
  totalSlides = computed(() => this.slides.length);

  private autoplayTimer: ReturnType<typeof setInterval> | null = null;
  private readonly AUTOPLAY_INTERVAL = 8000;

  ngOnInit(): void {
    this.startAutoplay();
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
  }

  private startAutoplay(): void {
    this.stopAutoplay();
    if (this.totalSlides() <= 1) return;
    this.autoplayTimer = setInterval(() => {
      if (!this.isPaused()) {
        this.next();
      }
    }, this.AUTOPLAY_INTERVAL);
  }

  private stopAutoplay(): void {
    if (this.autoplayTimer !== null) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  onMouseEnter(): void {
    this.isPaused.set(true);
  }

  onMouseLeave(): void {
    this.isPaused.set(false);
  }

  goToSlide(index: number): void {
    const total = this.totalSlides();
    if (index < 0) {
      this.currentSlide.set(total - 1);
    } else if (index >= total) {
      this.currentSlide.set(0);
    } else {
      this.currentSlide.set(index);
    }
  }

  prev(): void {
    this.goToSlide(this.currentSlide() - 1);
  }

  next(): void {
    this.goToSlide(this.currentSlide() + 1);
  }
}
