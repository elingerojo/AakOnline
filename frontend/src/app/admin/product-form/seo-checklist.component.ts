import { Component, computed, input } from '@angular/core';

/**
 * seo-checklist.component.ts — Checklist de metadatos SEO derivados del
 * formulario de producto (Corte 4b).
 *
 * No bloquea guardar: solo advierte si la ficha generada por Gemini saldría
 * publicable o necesitaría retrabajo. Todo se calcula en vivo con `computed()`
 * sobre los inputs (signals).
 */

export type ChecklistState = 'ok' | 'warn' | 'fail';

export interface ChecklistItem {
  key: string;
  label: string;
  state: ChecklistState;
  detail: string;
}

/** Lo que el build usa como `<title>` de la réplica estática. */
const TITLE_SUFFIX = ' — AakBejuco';
const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 120;
const DESCRIPTION_MAX = 160;
/** `generate-seo.mjs` recorta la meta description a 200 caracteres. */
const DESCRIPTION_HARD_MAX = 200;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 60;

const ICONS: Record<ChecklistState, string> = {
  ok: '✓',
  warn: '⚠',
  fail: '✕',
};

@Component({
  selector: 'app-seo-checklist',
  standalone: true,
  template: `
    <section class="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">🔍 Checklist SEO (metadatos)</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ okCount() }} ✓ · {{ warnCount() }} ⚠ · {{ failCount() }} ✕ — no bloquea guardar
        </p>
      </div>

      <ul class="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-1.5">
        @for (item of items(); track item.key) {
          <li class="flex items-start gap-2 text-sm">
            <span [class]="iconClass(item.state)" [attr.aria-label]="stateLabel(item.state)">
              {{ icon(item.state) }}
            </span>
            <span class="min-w-0">
              <span class="text-gray-700 dark:text-gray-200">{{ item.label }}</span>
              <span class="block text-xs text-gray-500 dark:text-gray-400">{{ item.detail }}</span>
            </span>
          </li>
        }
      </ul>
    </section>
  `,
})
export class SeoChecklistComponent {
  readonly name = input<string>('');
  readonly shortDescription = input<string>('');
  /** Slug que se guardará (derivado del nombre en el formulario). */
  readonly slug = input<string>('');
  readonly image = input<string>('');
  readonly categoryId = input<number | null>(null);
  readonly validCategoryIds = input<readonly number[]>([]);
  readonly status = input<string>('pendiente');

  protected readonly items = computed<ChecklistItem[]>(() => {
    const name = this.name().trim();
    const description = this.shortDescription().trim();
    const slug = this.slug().trim();
    const image = this.image().trim();
    const categoryId = this.categoryId();
    const status = this.status();

    const title = `${name}${TITLE_SUFFIX}`;
    const items: ChecklistItem[] = [];

    items.push({
      key: 'name',
      label: 'Nombre del producto',
      state: name.length > 0 ? 'ok' : 'fail',
      detail:
        name.length > 0
          ? 'Presente: alimenta título, slug y réplica estática.'
          : 'Falta el nombre: sin él no hay título, slug ni página estática.',
    });

    let titleState: ChecklistState;
    let titleDetail: string;
    if (name.length === 0) {
      titleState = 'fail';
      titleDetail = `Sin nombre no se puede calcular "${TITLE_SUFFIX.trim()}".`;
    } else if (title.length >= TITLE_MIN && title.length <= TITLE_MAX) {
      titleState = 'ok';
      titleDetail = `${title.length} caracteres (objetivo ${TITLE_MIN}–${TITLE_MAX}).`;
    } else if (title.length < TITLE_MIN) {
      titleState = 'warn';
      titleDetail = `${title.length} caracteres: corto, se desaprovecha el título (objetivo ${TITLE_MIN}–${TITLE_MAX}).`;
    } else {
      titleState = 'warn';
      titleDetail = `${title.length} caracteres: Google lo recortará (objetivo ${TITLE_MIN}–${TITLE_MAX}).`;
    }
    items.push({ key: 'title', label: 'Título de la página', state: titleState, detail: titleDetail });

    let descriptionState: ChecklistState;
    let descriptionDetail: string;
    if (description.length === 0) {
      descriptionState = 'fail';
      descriptionDetail = 'Vacía: la meta description saldría sin texto.';
    } else if (description.length < DESCRIPTION_MIN) {
      descriptionState = 'warn';
      descriptionDetail = `${description.length} caracteres: corta (objetivo ${DESCRIPTION_MIN}–${DESCRIPTION_MAX}).`;
    } else if (description.length <= DESCRIPTION_MAX) {
      descriptionState = 'ok';
      descriptionDetail = `${description.length} caracteres (objetivo ${DESCRIPTION_MIN}–${DESCRIPTION_MAX}).`;
    } else if (description.length <= DESCRIPTION_HARD_MAX) {
      descriptionState = 'warn';
      descriptionDetail = `${description.length} caracteres: dentro del límite, pero Google puede recortarla.`;
    } else {
      descriptionState = 'fail';
      descriptionDetail = `${description.length} caracteres: el build la recorta a ${DESCRIPTION_HARD_MAX}.`;
    }
    items.push({
      key: 'description',
      label: 'Descripción corta (meta description)',
      state: descriptionState,
      detail: descriptionDetail,
    });

    let slugState: ChecklistState;
    let slugDetail: string;
    if (slug.length === 0) {
      slugState = 'fail';
      slugDetail = 'Sin slug: se generará solo cuando haya nombre.';
    } else if (!SLUG_PATTERN.test(slug)) {
      slugState = 'warn';
      slugDetail = `${slug}: debe ser minúsculas, números y guiones.`;
    } else if (slug.length > SLUG_MAX) {
      slugState = 'warn';
      slugDetail = `${slug.length} caracteres: conviene acortarlo (máximo ${SLUG_MAX}).`;
    } else {
      slugState = 'ok';
      slugDetail = `/product/${slug} (${slug.length} caracteres).`;
    }
    items.push({ key: 'slug', label: 'Slug / URL del producto', state: slugState, detail: slugDetail });

    items.push({
      key: 'image',
      label: 'Imagen principal',
      state: image.length > 0 ? 'ok' : 'fail',
      detail:
        image.length > 0
          ? 'Presente: se usa en la tarjeta y como imagen social.'
          : 'Falta la imagen: Gemini no puede generar contenido y la tarjeta queda vacía.',
    });

    const validIds = this.validCategoryIds();
    const categoryOk = categoryId !== null && validIds.includes(Number(categoryId));
    items.push({
      key: 'category',
      label: 'Categoría válida',
      state: categoryOk ? 'ok' : 'fail',
      detail: categoryOk
        ? 'La categoría existe en el catálogo.'
        : 'Selecciona una categoría existente para que el producto se liste.',
    });

    const isActive = status === 'activo';
    items.push({
      key: 'status',
      label: 'Estado activo',
      state: isActive ? 'ok' : 'warn',
      detail: isActive
        ? 'Genera página estática y entra al sitemap.'
        : `Estado "${status}": no genera página estática ni aparece en Google.`,
    });

    return items;
  });

  protected readonly okCount = computed(
    () => this.items().filter((item) => item.state === 'ok').length
  );

  protected readonly warnCount = computed(
    () => this.items().filter((item) => item.state === 'warn').length
  );

  protected readonly failCount = computed(
    () => this.items().filter((item) => item.state === 'fail').length
  );

  protected icon(state: ChecklistState): string {
    return ICONS[state];
  }

  protected stateLabel(state: ChecklistState): string {
    return state === 'ok' ? 'Correcto' : state === 'warn' ? 'Advertencia' : 'Falta';
  }

  protected iconClass(state: ChecklistState): string {
    const tone: Record<ChecklistState, string> = {
      ok: 'text-green-600 dark:text-green-400',
      warn: 'text-amber-600 dark:text-amber-400',
      fail: 'text-red-600 dark:text-red-400',
    };
    return `shrink-0 font-bold leading-5 ${tone[state]}`;
  }
}
