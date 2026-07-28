import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CONTACT_CONFIG } from '../../core/data/contact.config';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="relative bg-overlay before:bg-title/95 text-gray-300"
            style="background-image: url('assets/img/bg/footer.jpg'); background-size: cover; background-position: center;">
      <div class="relative z-10 max-w-7xl mx-auto px-4 py-12">
        <!-- Brand & Description -->
        <div class="flex flex-col items-center text-center mb-10">
          <img src="assets/img/Logo_mini_Aak_para-App-02.png" alt="Aak Artesanias" class="w-[150px] sm:w-auto mb-4 brightness-0 invert" />
          <p class="text-sm text-gray-300 max-w-[522px] leading-relaxed">
            Aak Artesan&iacute;as en una tienda moderna con productos artesanales directos de los mismos artesanos que los elaboran siguiendo el oficio aprendido a trav&eacute;s de generaciones. Nos enorgullecemos de ofrecer &uacute;nicamente acabados y procesos de alta calidad realizados totalmente a mano.
          </p>
        </div>

        <!-- Columns -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <!-- Quick Links -->
          <div>
            <h3 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Enlaces</h3>
            <ul class="space-y-3">
              <li><a routerLink="/" class="text-sm text-white hover:text-primary transition-colors inline-block group"><span class="text-underline-primary">Inicio</span></a></li>
              <li><a routerLink="/shop" class="text-sm text-white hover:text-primary transition-colors inline-block group"><span class="text-underline-primary">Tienda</span></a></li>
              <li><a routerLink="/shipping" class="text-sm text-white hover:text-primary transition-colors inline-block group"><span class="text-underline-primary">Env&iacute;os</span></a></li>
              <li><a routerLink="/quote" class="text-sm text-white hover:text-primary transition-colors inline-block group"><span class="text-underline-primary">Cotizaci&oacute;n</span></a></li>
            </ul>
          </div>

          <!-- Categories -->
          <div>
            <h3 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Tienda</h3>
            <ul class="space-y-3">
              <li><a routerLink="/category/salas" class="text-sm text-white hover:text-primary transition-colors inline-block group"><span class="text-underline-primary">Salas</span></a></li>
              <li><a routerLink="/category/comedores" class="text-sm text-white hover:text-primary transition-colors inline-block group"><span class="text-underline-primary">Comedores</span></a></li>
              <li><a routerLink="/category/sillones" class="text-sm text-white hover:text-primary transition-colors inline-block group"><span class="text-underline-primary">Sillones</span></a></li>
              <li><a routerLink="/category/sillas" class="text-sm text-white hover:text-primary transition-colors inline-block group"><span class="text-underline-primary">Sillas</span></a></li>
            </ul>
          </div>

          <!-- Contact -->
          <div>
            <h3 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Contacto</h3>
            <ul class="space-y-3">
              <li>
                <a [href]="'https://wa.me/' + config.whatsapp.number" target="_blank" rel="noopener"
                   class="text-sm text-white hover:text-primary transition-colors">
                  <span class="inline-block w-5 text-center mr-1">&#x1F4AC;</span> WhatsApp
                </a>
              </li>
              <li>
                <a href="tel:{{config.phone}}" class="text-sm text-white hover:text-primary transition-colors">
                  <span class="inline-block w-5 text-center mr-1">&#x1F4DE;</span> {{ config.phone }}
                </a>
              </li>
              <li>
                <a href="mailto:{{config.email}}" class="text-sm text-white hover:text-primary transition-colors">
                  <span class="inline-block w-5 text-center mr-1">&#x2709;</span> {{ config.email }}
                </a>
              </li>
            </ul>
          </div>

          <!-- Hours & Social -->
          <div>
            <h3 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Horario</h3>
            <p class="text-sm text-gray-300 mb-4">{{ config.businessHours }}</p>
            <h3 class="text-sm font-semibold text-white uppercase tracking-wider mb-3">S&iacute;guenos</h3>
            <div class="flex gap-3">
              <a href="#" class="w-9 h-9 rounded-full border border-white/40 text-white/70 flex items-center justify-center hover:text-primary hover:border-primary transition-colors text-sm" aria-label="Facebook">FB</a>
              <a href="#" class="w-9 h-9 rounded-full border border-white/40 text-white/70 flex items-center justify-center hover:text-primary hover:border-primary transition-colors text-sm" aria-label="Instagram">IG</a>
            </div>
          </div>
        </div>

        <!-- Copyright -->
        <div class="mt-10 pt-6 border-t border-white/10 text-center">
          <p class="text-sm text-white/60">
            &copy; {{ currentYear }} Aak Artesan&iacute;as. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  protected config = CONTACT_CONFIG;
  protected currentYear = new Date().getFullYear();
}
