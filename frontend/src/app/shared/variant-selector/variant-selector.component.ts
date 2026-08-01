import { Component, input, model, computed } from '@angular/core';
import type { CategoryVariant } from '@shared/models/category.model';
import { formatCurrency } from '../../core/utils/text-utils';

export interface VariantSelectionResult {
  variantId: string;
  variantLabel: string;
  selectedOptionName: string;
  selectedOptionIndex: number;
  optionPrice: number;
}

@Component({
  selector: 'app-variant-selector',
  standalone: true,
  template: `
    <div class="space-y-4">
      @for (variant of variants(); track variant.id) {
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ variant.label }}
          </label>
          <div class="flex flex-wrap gap-2">
            @for (option of variant.options; track option.name; let i = $index) {
              @if (isEnabled(variant.id, i)) {
                <button
                  type="button"
                  (click)="selectOption(variant.id, variant.label, option, i)"
                  class="px-4 py-2 text-sm rounded-lg border-2 transition-all duration-200 cursor-pointer"
                  [class.border-amber-500]="isSelected(variant.id, i)"
                  [class.border-gray-200]="!isSelected(variant.id, i)"
                  [class.bg-amber-50]="isSelected(variant.id, i)"
                  [class.dark:bg-amber-900/20]="isSelected(variant.id, i)"
                  [class.text-amber-700]="isSelected(variant.id, i)"
                  [class.dark:text-amber-300]="isSelected(variant.id, i)"
                  class="hover:border-amber-300 dark:border-gray-600 dark:hover:border-amber-500"
                >
                  {{ option.name }}
                  @if (option.price !== 0) {
                    <span class="ml-1 text-xs opacity-75">{{ variantPriceLabel(option.price) }}</span>
                  }
                </button>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class VariantSelectorComponent {
  readonly variants = input.required<CategoryVariant[]>();
  readonly enabledIndices = input<{ variantId: string; enabledOptionIndices: number[] }[]>([]);
  readonly selections = model<VariantSelectionResult[]>([]);

  protected readonly formatCurrency = formatCurrency;

  /** Etiqueta del precio de la variante: "+$X" para extra, "-$X" para descuento, vacío si 0. */
  variantPriceLabel(price: number): string {
    if (price === 0) return '';
    return `${price > 0 ? '+' : '-'}${formatCurrency(Math.abs(price))}`;
  }

  isEnabled(variantId: string, optionIndex: number): boolean {
    const variant = this.enabledIndices().find(v => v.variantId === variantId);
    if (!variant) return true; // Enable all if no restriction
    return variant.enabledOptionIndices.includes(optionIndex);
  }

  isSelected(variantId: string, optionIndex: number): boolean {
    return this.selections().some(s => s.variantId === variantId && s.selectedOptionIndex === optionIndex);
  }

  selectOption(variantId: string, variantLabel: string, option: { name: string; price: number }, optionIndex: number): void {
    const current = this.selections();
    const existing = current.findIndex(s => s.variantId === variantId);

    const selection: VariantSelectionResult = {
      variantId,
      variantLabel,
      selectedOptionName: option.name,
      selectedOptionIndex: optionIndex,
      optionPrice: option.price,
    };

    if (existing >= 0) {
      const updated = [...current];
      updated[existing] = selection;
      this.selections.set(updated);
    } else {
      this.selections.set([...current, selection]);
    }
  }
}
