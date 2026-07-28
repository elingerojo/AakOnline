import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../../core/services/category.service';
import { ProductService } from '../../core/services/product.service';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { ScrollToTopComponent } from '../../shared/scroll-to-top/scroll-to-top.component';
import { ContactBarComponent } from '../../shared/contact-bar/contact-bar.component';
import { HeroSliderComponent } from '../../shared/hero-slider/hero-slider.component';
import { ScrollAnimationDirective } from '../../shared/scroll-animation/scroll-animation.directive';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    ProductCardComponent,
    NavbarComponent,
    FooterComponent,
    ScrollToTopComponent,
    ContactBarComponent,
    HeroSliderComponent,
    ScrollAnimationDirective,
  ],
  template: `
    <app-navbar />
    <app-contact-bar />

    <main>
      <!-- Hero Slider Section -->
      <app-hero-slider />

      <!-- Categories Section -->
      <section class="py-16 bg-white dark:bg-gray-900">
        <div class="max-w-7xl mx-auto px-4">
          <h2 class="text-2xl md:text-3xl font-bold text-center text-gray-900 dark:text-white mb-12"
              appScrollAnimation="fade-up">
            Categorias
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            @for (cat of categories(); track cat.id) {
              <a [routerLink]="['/category', cat.slug]"
                 class="group relative overflow-hidden rounded-xl aspect-square block"
                 appScrollAnimation="zoom-in">
                <img [src]="cat.productImage" [alt]="cat.name"
                     class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                <div class="absolute bottom-0 left-0 right-0 p-3 z-10">
                  <div class="bg-black/40 rounded px-3 py-1.5 inline-block">
                    <h3 class="text-white font-semibold text-sm leading-tight">{{ cat.name }}</h3>
                    <p class="text-white/70 text-xs mt-0.5">{{ cat.models }} modelos</p>
                  </div>
                </div>
              </a>
            }
          </div>
        </div>
      </section>

      <!-- Featured Products -->
      @if (featuredProducts().length > 0) {
        <section class="py-16 md:py-20 bg-gray-50 dark:bg-gray-800">
          <div class="container-fluid max-w-[1720px] mx-auto px-4 sm:px-6">
            <!-- Header -->
            <div class="max-w-xl mx-auto mb-8 md:mb-12 text-center" appScrollAnimation="fade-up">
              <div>
                <img src="assets/img/svg/sofa.svg" class="mx-auto w-14 sm:w-20" alt="destacados" />
              </div>
              <h2 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-4 md:mt-6">
                Productos Destacados
              </h2>
              <p class="text-gray-600 dark:text-gray-400 mt-3">
                Descubra productos excepcionales que contribuyen a mejorar su estilo de vida con dise&ntilde;o, calidad e innovaci&oacute;n.
              </p>
            </div>

            <!-- Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-8"
                 appScrollAnimation="fade-up" [scrollDelay]="100">
              @for (product of featuredProducts(); track product.id) {
                <app-product-card [product]="product" />
              }
            </div>
          </div>
        </section>
      }

      <!-- Why Us / Ofrecemos -->
      <section class="relative py-16 md:py-20 bg-overlay before:bg-black/60 dark:before:bg-title/80"
               style="background-image: url('assets/img/home-v1/choose-us-bg-02.jpg'); background-size: cover; background-position: center;">
        <!-- Shape decoration -->
        <img class="absolute top-0 right-0 w-[20%] z-0 pointer-events-none"
             src="assets/img/home-v1/shape-01.png" alt="shape">

        <div class="container-fluid relative z-10">
          <div class="max-w-[1720px] mx-auto">
            <div class="max-w-[1186px] ml-auto">
              <!-- Header -->
              <div class="max-w-xl mb-8 md:mb-12" appScrollAnimation="fade-up">
                <div>
                  <img src="assets/img/svg/like.svg" class="w-14 sm:w-20" alt="ofrecemos" />
                </div>
                <h2 class="text-2xl md:text-3xl font-bold text-white mt-4 md:mt-6">
                  Ofrecemos
                </h2>
                <p class="text-gray-300 mt-3">
                  Piezas artesanales de calidad, atenci&oacute;n y servicio personal enfocado en su satisfacci&oacute;n.
                </p>
              </div>

              <!-- Cards grid -->
              <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-[30px]">
                <div class="why-choose-card p-6 rounded-[10px]"
                     appScrollAnimation="fade-up" [scrollDelay]="100">
                  <img src="assets/img/svg/fea-1.svg" class="size-12" alt="">
                  <h4 class="font-semibold leading-none mt-5 sm:mt-7 text-xl md:text-2xl">Directo del Artesano</h4>
                  <p class="mt-[15px] text-sm">Todos los productos son hechos a mano. Somos artesanos mexicanos con m&eacute;todos y tradiciones de fabricaci&oacute;n que hemos heredado de nuestros ancestros.</p>
                </div>

                <div class="why-choose-card p-6 rounded-[10px]"
                     appScrollAnimation="fade-up" [scrollDelay]="200">
                  <img src="assets/img/svg/fea-5.svg" class="size-12" alt="">
                  <h4 class="font-semibold leading-none mt-5 sm:mt-7 text-xl md:text-2xl">Calidad Evidente</h4>
                  <p class="mt-[15px] text-sm">Cuidamos cada detalle para ofrecerte piezas &uacute;nicas. Nuestra calidad superior no solo garantiza una belleza inigualable, sino tambi&eacute;n una durabilidad excepcional.</p>
                </div>

                <div class="why-choose-card p-6 rounded-[10px]"
                     appScrollAnimation="fade-up" [scrollDelay]="300">
                  <img src="assets/img/svg/fea-4.svg" class="size-12" alt="">
                  <h4 class="font-semibold leading-none mt-5 sm:mt-7 text-xl md:text-2xl">Servicio a Cliente</h4>
                  <p class="mt-[15px] text-sm">Todo nuestro equipo est&aacute; enfocado en la atenci&oacute;n al cliente. Reciba asistencia personalizada en cada paso del proceso de compra. Nos gusta servir.</p>
                </div>

                <div class="why-choose-card p-6 rounded-[10px]"
                     appScrollAnimation="fade-up" [scrollDelay]="400">
                  <img src="assets/img/svg/fea-2.svg" class="size-12" alt="">
                  <h4 class="font-semibold leading-none mt-5 sm:mt-7 text-xl md:text-2xl">Experiencia en Embarque</h4>
                  <p class="mt-[15px] text-sm">Amplia experiencia en embarque de muebles artesanales. Especial esmero en la protecci&oacute;n e integridad del contenido para evitar contratiempos en el traslado.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <app-footer />
    <app-scroll-to-top />
  `,
})
export class HomeComponent implements OnInit {
  private categoryService = inject(CategoryService);
  private productService = inject(ProductService);
  private seoService = inject(SeoService);

  protected categories = this.categoryService.categories;
  protected featuredProducts = this.productService.featuredProducts;

  ngOnInit(): void {
    this.seoService.setPageSeo({
      title: 'Aak Artesanías — Muebles Artesanales Mexicanos',
      description:
        'Descubra muebles artesanales mexicanos hechos a mano. Calidad, diseño e innovación en piezas únicas para el hogar.',
    });
  }
}
