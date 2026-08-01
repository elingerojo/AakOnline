import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Navegación mínima del panel de administración (Catálogo · Categorías · Envío).
 */
@Component({
  selector: 'app-admin-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-300">
      <a routerLink="/admin" routerLinkActive="text-amber-600" [routerLinkActiveOptions]="{ exact: true }"
         class="hover:text-amber-600 transition-colors">Catálogo</a>
      <a routerLink="/admin/categories" routerLinkActive="text-amber-600"
         class="hover:text-amber-600 transition-colors">Categorías</a>
      <a routerLink="/admin/shipping" routerLinkActive="text-amber-600"
         class="hover:text-amber-600 transition-colors">Envío</a>
    </nav>
  `,
})
export class AdminNavComponent {}
