import { Component, ElementRef, ViewChild, OnDestroy, input } from '@angular/core';
import lightGallery from 'lightgallery';
import lgZoom from 'lightgallery/plugins/zoom';

type LightGalleryInstance = ReturnType<typeof lightGallery>;

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  template: `
    <div class="grid grid-cols-1 gap-4">
      <!-- Main image: opens the fullscreen viewer with zoom & pan -->
      <div class="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
        <button
          type="button"
          class="block w-full h-full m-0 p-0 border-0 bg-transparent cursor-pointer"
          (click)="openViewer()"
          [disabled]="!selectedImage()"
          [attr.aria-label]="selectedImage() ? 'Ver imagen del producto en grande' : undefined"
        >
          <img
            [src]="selectedImage()"
            alt="Imagen del producto"
            class="w-full h-full object-cover"
            draggable="false"
          />
        </button>
      </div>

      <!-- Thumbnails -->
      @if (images().length > 1) {
        <div class="flex gap-2 overflow-x-auto pb-2">
          @for (img of images(); track img; let i = $index) {
            <button
              type="button"
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

      <!-- Hidden host element for the lightGallery instance -->
      <div #lgContainer class="hidden" aria-hidden="true"></div>
    </div>
  `,
})
export class ImageGalleryComponent implements OnDestroy {
  readonly images = input<string[]>([]);
  protected selectedIndex = 0;

  @ViewChild('lgContainer', { static: true })
  private lgContainer?: ElementRef<HTMLDivElement>;

  private lg?: LightGalleryInstance;

  selectedImage(): string {
    return this.images()[this.selectedIndex] || this.images()[0] || '';
  }

  selectImage(index: number): void {
    this.selectedIndex = index;
  }

  openViewer(): void {
    const src = this.selectedImage();
    if (!src || !this.lgContainer) return;

    if (!this.lg) {
      this.lg = lightGallery(this.lgContainer.nativeElement, {
        dynamic: true,
        dynamicEl: [this.toItem(src)],
        plugins: [lgZoom],
        mode: 'lg-fade',
        controls: false,
        counter: false,
        download: false,
        showMaximizeIcon: false,
        loop: false,
        hideBarsDelay: 0,
      });
    } else if (this.lg.galleryItems[0]?.src !== src) {
      this.lg.refresh([this.toItem(src)]);
    }

    this.lg.openGallery(0);
  }

  private toItem(src: string): { src: string; thumb: string; alt: string } {
    return { src, thumb: src, alt: 'Imagen del producto' };
  }

  ngOnDestroy(): void {
    this.lg?.destroy();
    this.lg = undefined;
  }
}
