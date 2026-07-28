import { Component, output, input } from '@angular/core';

@Component({
  selector: 'app-inc-dec',
  standalone: true,
  template: `
    <div class="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      <button
        (click)="decrement()"
        [disabled]="value() <= min()"
        class="px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
               disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        aria-label="Disminuir cantidad"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
        </svg>
      </button>
      <span class="px-4 py-1.5 text-sm font-medium text-gray-900 dark:text-white min-w-[3rem] text-center select-none">
        {{ value() }}
      </span>
      <button
        (click)="increment()"
        [disabled]="value() >= max()"
        class="px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
               disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        aria-label="Aumentar cantidad"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  `,
})
export class IncDecComponent {
  readonly value = input<number>(1);
  readonly min = input<number>(1);
  readonly max = input<number>(99);
  readonly changed = output<number>();

  private currentValue = 1;

  ngOnChanges(): void {
    this.currentValue = this.value();
  }

  increment(): void {
    if (this.currentValue < this.max()) {
      this.currentValue++;
      this.changed.emit(this.currentValue);
    }
  }

  decrement(): void {
    if (this.currentValue > this.min()) {
      this.currentValue--;
      this.changed.emit(this.currentValue);
    }
  }
}
