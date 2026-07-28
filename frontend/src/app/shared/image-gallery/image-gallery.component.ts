import { Component, input } from '@angular/core';

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  template: `
    <div class="grid grid-cols-1 gap-4">
      <!-- Main image -->
      <div class="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
        <img
          [src]="selectedImage()"
          alt="Imagen del producto"
          class="w-full h-full object-cover"
        />
      </div>

      <!-- Thumbnails -->
      @if (images().length > 1) {
        <div class="flex gap-2 overflow-x-auto pb-2">
          @for (img of images(); track img; let i = $index) {
            <button
              (click)="selectImage(i)"
              class="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors cursor-pointer"
              [class.border-amber-500]="selectedIndex === i"
              [class.border-transparent]="selectedIndex !== i"
            >
              <img [src]="img" alt="" class="w-full h-full object-cover" loading="lazy" />
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ImageGalleryComponent {
  readonly images = input<string[]>([]);
  protected selectedIndex = 0;

  selectedImage(): string {
    return this.images()[this.selectedIndex] || this.images()[0] || '';
  }

  selectImage(index: number): void {
    this.selectedIndex = index;
  }
}
