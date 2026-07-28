import { Component, OnInit, inject } from '@angular/core';
import * as AOS from 'aos';
import { SeoService } from '../../core/services/seo.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { FooterComponent } from '../../shared/footer/footer.component';
import { ScrollToTopComponent } from '../../shared/scroll-to-top/scroll-to-top.component';
import { ContactBarComponent } from '../../shared/contact-bar/contact-bar.component';

@Component({
  selector: 'app-shipping',
  standalone: true,
  imports: [
    NavbarComponent,
    FooterComponent,
    ScrollToTopComponent,
    ContactBarComponent,
  ],
  template: `
    <app-navbar />
    <app-contact-bar />

    <main class="min-h-screen bg-white dark:bg-gray-900">
      <!-- Header -->
      <section class="bg-gradient-to-r from-amber-50 to-orange-100 dark:from-gray-800 dark:to-gray-700 py-12">
        <div class="max-w-7xl mx-auto px-4">
          <h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white" data-aos="fade-up">
            Metodos de Envio
          </h1>
          <p class="text-gray-600 dark:text-gray-300 mt-2" data-aos="fade-up" data-aos-delay="100">
            Informacion sobre nuestros metodos de envio y entregas
          </p>
        </div>
      </section>

      <!-- Content -->
      <section class="py-12">
        <div class="max-w-4xl mx-auto px-4 space-y-8">
          <div class="prose dark:prose-invert max-w-none" data-aos="fade-up">
            <h2>Transporte y Logistica</h2>
            <p>
              Comprendemos la importancia de sus muebles artesanales y el cuidado que requieren.
              Contamos con amplia experiencia en embarques terrestres a nivel regional, destacando
              por nuestra tecnica especializada en el manejo de mobiliario.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6" data-aos="fade-up">
            <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Empaque Especializado</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Cada pieza se embala individualmente con materiales de alta densidad para evitar
                roces y danos durante el trayecto.
              </p>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Desensamble Estrategico</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Los muebles se separan en sus componentes para un transporte mas seguro y eficiente.
              </p>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Cobertura Regional</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Realizamos envios a nivel regional con tiempos de entrega estimados segun la distancia.
              </p>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Calculo de Costo</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                El costo de envio se calcula en tu cotizacion segun la distancia y categoria del producto.
                Usa nuestra calculadora en la pagina de cotizacion.
              </p>
            </div>
          </div>

          <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800" data-aos="fade-up">
            <h3 class="font-semibold text-amber-800 dark:text-amber-300 mb-2">Importante</h3>
            <p class="text-sm text-amber-700 dark:text-amber-400">
              Los costos de envio son estimados. El costo final se confirmara al momento de realizar
              tu pedido a traves de nuestros canales de contacto.
            </p>
          </div>
        </div>
      </section>
    </main>

    <app-footer />
    <app-scroll-to-top />
  `,
})
export class ShippingComponent implements OnInit {
  private seoService = inject(SeoService);

  ngOnInit(): void {
    AOS.init({ delay: 0, duration: 600, easing: 'ease-out', once: true });
    this.seoService.setPageSeo({
      title: 'Métodos de Envío — Aak Artesanías',
      description: 'Información sobre nuestros métodos de envío, empaque especializado y cobertura regional para muebles artesanales.',
    });
  }
}
