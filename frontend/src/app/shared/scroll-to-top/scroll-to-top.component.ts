import { Component, HostListener } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-scroll-to-top',
  standalone: true,
  imports: [NgIf],
  template: `
    <button
      *ngIf="isVisible"
      (click)="scrollToTop()"
      class="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-amber-600 text-white shadow-lg
             hover:bg-amber-700 transition-all duration-300 cursor-pointer
             focus:outline-none focus:ring-2 focus:ring-amber-500"
      aria-label="Volver arriba"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
      </svg>
    </button>
  `,
})
export class ScrollToTopComponent {
  isVisible = false;

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isVisible = window.scrollY > 300;
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
